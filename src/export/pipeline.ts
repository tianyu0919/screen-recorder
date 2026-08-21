import { Compositor } from '../render/compositor'
import { estimateSystemOffsetSec } from '../lib/audioAlign'
import { sampleCameraAt } from '../timeline/spring'
import {
  cutPcm,
  encodeAudio,
  fetchSessionWav,
  mixTracks,
  probeAudioEncoder,
  slicePcm
} from './audio'
import { ExportError, WebmFrameDecoder } from './decoder'
import { OUTPUT_FPS, OUTPUT_HEIGHT, OUTPUT_WIDTH, createMuxer, probeVideoEncoder } from './encoder'
import { effectiveDurationMs, normalizeCuts, outputToSourceMs } from '../timeline/cuts'
import type { ExportDoneMessage, ExportStartMessage } from './messages'
import { keyOverlayFrameAt } from '../render/keyOverlay'

/**
 * 时间轴驱动主循环（Task 2.1 / 2.2）：
 * 固定 60fps，t = i/60 秒；每帧 sampleCameraAt 求相机 → 取源帧 →
 * 合成器渲染到 OffscreenCanvas → new VideoFrame(canvas) 喂 VideoEncoder。
 * 渲染慢只拉长总耗时，不影响输出时间戳（确定性逐帧，与预览同一合成路径）。
 */

/** 关键帧间隔（2 秒 @60fps） */
const KEYFRAME_INTERVAL = 120
/** 编码器输入队列背压上限 */
const MAX_ENCODE_QUEUE = 8
/** 每渲染 N 帧上报一次进度 */
const PROGRESS_INTERVAL = 30

export async function runExport(
  params: ExportStartMessage,
  onProgress: (done: number, total: number) => void
): Promise<Omit<ExportDoneMessage, 'type'>> {
  const videoUrl = `media://rec/${params.sessionId}/screen.webm`
  const { decoder, durationSec } = await WebmFrameDecoder.open(videoUrl)

  let compositor: Compositor | null = null
  let encoder: VideoEncoder | null = null
  try {
    // 真实时长以源视频为准；computeDuration 拿不到时回退时间轴估计
    const durationMs =
      Number.isFinite(durationSec) && durationSec > 0
        ? durationSec * 1000
        : params.fallbackDurationMs
    if (durationMs <= 0) throw new ExportError('源视频时长为空，无法导出')
    // 裁剪：输出时间轴 = 源时间轴 - 裁剪区间（视频逐帧映射 + 音频 PCM 拼接，同一份换算）
    const cuts = normalizeCuts(params.cuts, durationMs)
    const outDurationMs = effectiveDurationMs(durationMs, cuts)

    const choice = await probeVideoEncoder()

    // 音频：mic.wav + system.wav 两轨混合（缺失/解析失败/编码不支持 → 无音轨继续，结果里标注）
    // 两轨都在时先做回声对齐（音箱外放时 mic 轨含系统音，采集链延迟差见 lib/audioAlign.ts）
    const [micWav, systemWav] = await Promise.all([
      fetchSessionWav(params.sessionId, 'mic.wav'),
      fetchSessionWav(params.sessionId, 'system.wav')
    ])
    const sysOffset = micWav && systemWav ? estimateSystemOffsetSec(micWav, systemWav) : 0
    // 源时间轴 N 轨混音：mic / system（带回声对齐偏移）/ 自定义 clips（offsetMs → 负 offsetSec）；
    // 分轨增益（检查器音频滑杆）随混音应用，预览/导出听感一致；裁剪统一走下方 cutPcm
    const mixed = mixTracks([
      { wav: micWav, gain: params.audioGain.mic },
      { wav: systemWav, offsetSec: sysOffset, gain: params.audioGain.system },
      ...params.customAudio.map((c) => ({
        wav: slicePcm(
          {
            sampleRate: c.sampleRate,
            channels: c.channels,
            samples: new Int16Array(c.samples)
          },
          c.trimStartMs,
          c.trimEndMs
        ),
        offsetSec: -c.offsetMs / 1000,
        gain: c.gain
      }))
    ])
    // 所有音轨先限制到真实视频片尾，再应用视频裁剪区间，避免长 BGM 拉长容器时长。
    const sourceBounded = mixed ? slicePcm(mixed, 0, durationMs) : null
    const wav = sourceBounded && cuts.length > 0 ? cutPcm(sourceBounded, cuts) : sourceBounded
    const audioChoice = wav ? await probeAudioEncoder(choice.format, wav) : null
    const muxer = createMuxer(
      choice,
      audioChoice && wav
        ? { sampleRate: wav.sampleRate, numberOfChannels: wav.channels }
        : null
    )

    const canvas = new OffscreenCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT)
    compositor = new Compositor(canvas)
    compositor.setCanvasSize(params.canvas)

    let encodeError: unknown = null
    encoder = new VideoEncoder({
      output: (chunk, meta) => void muxer.addVideoChunk(chunk, meta),
      error: (err) => {
        encodeError = err
      }
    })
    encoder.configure(choice.config)

    const totalFrames = Math.max(1, Math.ceil((outDurationMs / 1000) * OUTPUT_FPS))
    const frameDurationUs = 1e6 / OUTPUT_FPS
    for (let i = 0; i < totalFrames; i++) {
      if (encodeError) throw new ExportError(`视频编码失败: ${errMsg(encodeError)}`)
      const sourceMs = outputToSourceMs((i / OUTPUT_FPS) * 1000, cuts)
      const source = await decoder.frameAt(sourceMs / 1000)
      if (!source) throw new ExportError('源视频无法解码: 没有可用帧')
      const camera = sampleCameraAt(params.keyframes, params.canvas, sourceMs)
      const keyOverlay = keyOverlayFrameAt(
        params.keyPrompts,
        sourceMs,
        params.keyboardOverlay,
        { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
      )
      compositor.drawFrame(source, camera, sourceMs, params.ripples, keyOverlay)
      // 捕获前 flush：确保 WebGL 绘制命令已提交，VideoFrame 快照拿到本帧内容
      compositor.flush()
      const outFrame = new VideoFrame(canvas, {
        timestamp: Math.round(i * frameDurationUs),
        duration: Math.round(frameDurationUs)
      })
      encoder.encode(outFrame, { keyFrame: i % KEYFRAME_INTERVAL === 0 })
      outFrame.close()
      if (i % PROGRESS_INTERVAL === 0) onProgress(i, totalFrames)
      // 背压：渲染快于编码时挂起，等编码队列消化
      if (encoder.encodeQueueSize > MAX_ENCODE_QUEUE) {
        await new Promise<void>((resolve) => {
          encoder!.addEventListener('dequeue', () => resolve(), { once: true })
        })
      }
    }
    await encoder.flush()

    // 音轨编码失败降级为无音轨结果（不视为导出失败）
    let hasAudio = false
    if (wav && audioChoice) {
      try {
        await encodeAudio(wav, audioChoice, muxer)
        hasAudio = true
      } catch {
        hasAudio = false
      }
    }

    const buffer = await muxer.finalize()
    onProgress(totalFrames, totalFrames)
    return {
      buffer,
      format: choice.format,
      audio: hasAudio,
      frames: totalFrames,
      durationMs: outDurationMs
    }
  } finally {
    if (encoder && encoder.state !== 'closed') encoder.close()
    compositor?.dispose()
    decoder.dispose()
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
