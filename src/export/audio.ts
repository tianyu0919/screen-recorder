import type { ExportFormat } from './messages'
import { ExportError } from './decoder'
import type { ExportMuxer } from './encoder'
import type { CutRange } from '../timeline/cuts'

/**
 * 音频混入（kr-03 Task 2.4 / kr-01 system-audio）：
 * 手写 RIFF/WAV 解析（找 'data' chunk，不假设固定 44 字节头）→
 * mic.wav + system.wav 两轨混合（mixPcm，纯函数）→
 * AudioEncoder 分块编码（每块 1024 采样）→ AAC chunk 进 muxer 音轨。
 * mp4 路径用 AAC（mp4a.40.2）；webm 容器不支持 AAC，fallback 路径用 opus。
 * 音频缺失 / 解析失败 / 编码不支持 → 无音轨继续，不视为导出失败。
 */

/** AAC 每帧采样数（AudioEncoder 分块粒度） */
const SAMPLES_PER_CHUNK = 1024
const AUDIO_BITRATE = 128_000

export interface WavData {
  sampleRate: number
  channels: number
  /** 16-bit PCM 交错采样（长度 = 帧数 × channels） */
  samples: Int16Array
}

/** 解析 16-bit PCM WAV；非 PCM/非 16bit/结构损坏抛 ExportError */
export function parseWav(buffer: ArrayBuffer): WavData {
  const view = new DataView(buffer)
  if (buffer.byteLength < 12 || view.getUint32(0, true) !== 0x46464952 /* 'RIFF' */ ||
      view.getUint32(8, true) !== 0x45564157 /* 'WAVE' */) {
    throw new ExportError('麦克风音频不是合法 WAV 文件')
  }
  let sampleRate = 0
  let channels = 0
  let bitsPerSample = 0
  let audioFormat = 0
  let dataOffset = -1
  let dataLength = 0
  // 遍历 RIFF chunk 列表：fmt 与 data 顺序不固定，可能夹带 LIST/fact 等
  let offset = 12
  while (offset + 8 <= buffer.byteLength) {
    const id = view.getUint32(offset, true)
    const size = view.getUint32(offset + 4, true)
    const body = offset + 8
    if (id === 0x20746d66 /* 'fmt ' */) {
      audioFormat = view.getUint16(body, true)
      channels = view.getUint16(body + 2, true)
      sampleRate = view.getUint32(body + 4, true)
      bitsPerSample = view.getUint16(body + 14, true)
    } else if (id === 0x61746164 /* 'data' */) {
      dataOffset = body
      dataLength = Math.min(size, buffer.byteLength - body)
    }
    // chunk 按 2 字节对齐
    offset = body + size + (size % 2)
  }
  if (audioFormat !== 1 || bitsPerSample !== 16 || channels < 1 || channels > 2 || sampleRate <= 0) {
    throw new ExportError('麦克风音频格式不支持（需要 16-bit PCM WAV）')
  }
  if (dataOffset < 0 || dataLength < 2) {
    throw new ExportError('麦克风音频没有采样数据')
  }
  const frameCount = Math.floor(dataLength / (2 * channels))
  return {
    sampleRate,
    channels,
    samples: new Int16Array(buffer, dataOffset, frameCount * channels)
  }
}

/** worker 内拉取会话音频轨（mic.wav / system.wav）；不存在/拉取失败返回 null（无音轨继续） */
export async function fetchSessionWav(
  sessionId: string,
  file: 'mic.wav' | 'system.wav'
): Promise<WavData | null> {
  try {
    const res = await fetch(`media://rec/${sessionId}/${file}`)
    if (!res.ok) return null
    return parseWav(await res.arrayBuffer())
  } catch {
    return null
  }
}

/** 整轨增益缩放（0–1，kr-05-audio-volume）；gain=1 原样返回（零开销、逐样本一致） */
export function scalePcm(wav: WavData | null, gain: number): WavData | null {
  if (!wav || gain === 1) return wav
  const out = new Int16Array(wav.samples.length)
  for (let i = 0; i < wav.samples.length; i++) {
    out[i] = Math.max(-32768, Math.min(32767, Math.round(wav.samples[i] * gain)))
  }
  return { ...wav, samples: out }
}

export interface MixTrack {
  wav: WavData | null
  /** 输出时刻 t 读取该轨 t + offsetSec 处采样（clip 起始 offsetMs → -offsetMs/1000） */
  offsetSec?: number
  /** 音量增益（0–1，默认 1） */
  gain?: number
}

/**
 * N 轨 PCM 混合（kr-05 custom-audio-track 泛化，纯函数）：
 * - 单轨且 gain=1 无偏移 → 原样直通（零开销、逐样本一致）；
 * - 输出长度取各轨（偏移后）最长结束点；
 * - 采样率不同以较高者为准（线性插值重采样）；声道以较多者为准（单声道复制）；
 * - 逐帧相加后 int16 clamp 防削波。
 */
export function mixTracks(tracks: MixTrack[]): WavData | null {
  const valid = tracks.filter((t): t is MixTrack & { wav: WavData } => t.wav !== null)
  if (valid.length === 0) return null
  if (valid.length === 1) {
    const t = valid[0]
    if (!t.offsetSec) return scalePcm(t.wav, t.gain ?? 1)
  }
  const sampleRate = Math.max(...valid.map((t) => t.wav.sampleRate))
  const channels = Math.max(...valid.map((t) => t.wav.channels))
  const framesOf = (w: WavData): number => Math.floor(w.samples.length / w.channels)
  // 该轨在输出时间轴上的结束帧（起点可能 >0：offsetSec<0 表示内容从 |offsetSec| 秒处才开始）
  const endFrameOf = (t: MixTrack & { wav: WavData }): number =>
    Math.ceil((framesOf(t.wav) / t.wav.sampleRate - (t.offsetSec ?? 0)) * sampleRate)
  const frames = Math.max(0, ...valid.map(endFrameOf))
  if (frames === 0) return null
  /** 读 wav 在输出帧 outFrame 处、声道 ch 的采样值（线性插值；范围外返回 0） */
  const readAt = (wav: WavData, outFrame: number, ch: number, offsetSec: number): number => {
    const srcFrames = framesOf(wav)
    const srcPos = (outFrame / sampleRate + offsetSec) * wav.sampleRate
    if (srcPos < 0 || srcPos >= srcFrames) return 0
    const i0 = Math.floor(srcPos)
    const i1 = Math.min(i0 + 1, srcFrames - 1)
    const frac = srcPos - i0
    const c = Math.min(ch, wav.channels - 1)
    const s0 = wav.samples[i0 * wav.channels + c]
    const s1 = wav.samples[i1 * wav.channels + c]
    return s0 + (s1 - s0) * frac
  }
  const out = new Int16Array(frames * channels)
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      let mixed = 0
      for (const t of valid) mixed += readAt(t.wav, i, c, t.offsetSec ?? 0) * (t.gain ?? 1)
      out[i * channels + c] = Math.max(-32768, Math.min(32767, Math.round(mixed)))
    }
  }
  return { sampleRate, channels, samples: out }
}

/**
 * 双轨 PCM 混合（kr-01 system-audio；现为 mixTracks 的包装，保持既有调用与 smoke 脚本不动）：
 * - bOffsetSec：system 轨对齐偏移（estimateSystemOffsetSec 估计，正=system 内容偏晚需提前）；
 *   音箱外放时 mic 会录入系统音形成回声，靠此对齐消除
 * - gainA/gainB：分轨音量增益（0–1，检查器音频滑杆；默认 1 与既有行为逐样本一致）
 */
export function mixPcm(
  a: WavData | null,
  b: WavData | null,
  bOffsetSec = 0,
  gainA = 1,
  gainB = 1
): WavData | null {
  return mixTracks([
    { wav: a, gain: gainA },
    { wav: b, offsetSec: bOffsetSec, gain: gainB }
  ])
}

/** 非破坏性截取 PCM 的时间区间；返回独立 samples，便于后续混音/结构化克隆。 */
export function slicePcm(wav: WavData, startMs: number, endMs: number): WavData {
  const frames = Math.floor(wav.samples.length / wav.channels)
  const frameAt = (ms: number): number =>
    Math.min(frames, Math.max(0, Math.round((ms / 1000) * wav.sampleRate)))
  const startFrame = frameAt(startMs)
  const endFrame = Math.max(startFrame, frameAt(endMs))
  return {
    sampleRate: wav.sampleRate,
    channels: wav.channels,
    samples: wav.samples.slice(startFrame * wav.channels, endFrame * wav.channels)
  }
}

/** 按裁剪区间拼接保留段 PCM（与视频帧的 outputToSourceMs 映射一致，音画同步不漂移） */
export function cutPcm(wav: WavData, cuts: CutRange[]): WavData {
  if (cuts.length === 0) return wav
  const frames = Math.floor(wav.samples.length / wav.channels)
  const frameOf = (ms: number): number =>
    Math.min(frames, Math.max(0, Math.round((ms / 1000) * wav.sampleRate)))
  // 保留区间 = [0, c0.start) ∪ [c0.end, c1.start) ∪ … ∪ [cn.end, frames)
  const kept: Array<[number, number]> = []
  let prev = 0
  for (const c of cuts) {
    kept.push([prev, frameOf(c.startMs)])
    prev = frameOf(c.endMs)
  }
  kept.push([prev, frames])
  const totalFrames = kept.reduce((acc, [s, e]) => acc + Math.max(0, e - s), 0)
  const out = new Int16Array(totalFrames * wav.channels)
  let offset = 0
  for (const [s, e] of kept) {
    const len = Math.max(0, e - s)
    if (len === 0) continue
    out.set(wav.samples.subarray(s * wav.channels, e * wav.channels), offset)
    offset += len * wav.channels
  }
  return { sampleRate: wav.sampleRate, channels: wav.channels, samples: out }
}

export interface AudioEncoderChoice {
  config: AudioEncoderConfig
}

/** 按容器格式探测音频编码：mp4 → AAC；webm → opus。不支持返回 null（无音轨继续） */
export async function probeAudioEncoder(
  format: ExportFormat,
  wav: WavData
): Promise<AudioEncoderChoice | null> {
  const config: AudioEncoderConfig = {
    codec: format === 'mp4' ? 'mp4a.40.2' : 'opus',
    sampleRate: wav.sampleRate,
    numberOfChannels: wav.channels,
    bitrate: AUDIO_BITRATE
  }
  const support = await AudioEncoder.isConfigSupported(config)
  return support.supported ? { config } : null
}

/**
 * 编码全部采样并写入 muxer 音轨。
 * 时间轴与视频同一原点：chunk 时间戳 = 采样偏移 / sampleRate（µs）。
 * 编码失败抛 ExportError 由 pipeline 降级为"无音轨继续"。
 */
export async function encodeAudio(
  wav: WavData,
  choice: AudioEncoderChoice,
  muxer: ExportMuxer
): Promise<void> {
  let encodeError: unknown = null
  const encoder = new AudioEncoder({
    output: (chunk, meta) => void muxer.addAudioChunk(chunk, meta),
    error: (err) => {
      encodeError = err
    }
  })
  encoder.configure(choice.config)
  const totalFrames = Math.floor(wav.samples.length / wav.channels)
  for (let frame = 0; frame < totalFrames; frame += SAMPLES_PER_CHUNK) {
    const count = Math.min(SAMPLES_PER_CHUNK, totalFrames - frame)
    // AudioData 构造会拷贝数据；逐块 slice 避免底层 buffer 复用歧义
    const block = wav.samples.slice(frame * wav.channels, (frame + count) * wav.channels)
    const data = new AudioData({
      format: 's16',
      sampleRate: wav.sampleRate,
      numberOfChannels: wav.channels,
      numberOfFrames: count,
      timestamp: Math.round((frame / wav.sampleRate) * 1e6),
      data: block.buffer
    })
    encoder.encode(data)
    data.close()
    // 背压：编码队列堆积时等出队
    if (encoder.encodeQueueSize > 8) {
      await new Promise<void>((resolve) => {
        encoder.addEventListener('dequeue', () => resolve(), { once: true })
      })
    }
  }
  await encoder.flush()
  encoder.close()
  if (encodeError) throw new ExportError(`音频编码失败: ${errMsg(encodeError)}`)
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
