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

/**
 * 双轨 PCM 混合（kr-01 system-audio，纯函数）：
 * - bOffsetSec：system 轨对齐偏移（estimateSystemOffsetSec 估计，正=system 内容偏晚需提前）；
 *   音箱外放时 mic 会录入系统音形成回声，靠此对齐消除
 * - 单轨直通；两轨都在时按输出采样率逐帧对齐相加，int16 clamp 防削波；
 * - 采样率不同以较高者为准，低采样率轨做线性插值重采样；
 * - 声道不同以较多者为准，单声道轨复制到所有输出声道；
 * - 长度取两轨较长者，短轨结束后按静音处理。
 */
export function mixPcm(a: WavData | null, b: WavData | null, bOffsetSec = 0): WavData | null {
  if (!a) return b
  if (!b) return a
  const sampleRate = Math.max(a.sampleRate, b.sampleRate)
  const channels = Math.max(a.channels, b.channels)
  const framesOf = (w: WavData): number => Math.floor(w.samples.length / w.channels)
  const frames = Math.max(
    Math.ceil((framesOf(a) / a.sampleRate) * sampleRate),
    Math.ceil((framesOf(b) / b.sampleRate) * sampleRate)
  )
  /** 读 wav 在输出帧 outFrame 处、声道 ch 的采样值（线性插值；结尾后返回 0）
   *  offsetSec 为该轨的对齐偏移（正=内容偏晚，读取位置相应前移） */
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
      const mixed = readAt(a, i, c, 0) + readAt(b, i, c, bOffsetSec)
      out[i * channels + c] = Math.max(-32768, Math.min(32767, Math.round(mixed)))
    }
  }
  return { sampleRate, channels, samples: out }
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
