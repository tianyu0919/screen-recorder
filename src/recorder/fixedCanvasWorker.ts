import { fitRectCentered } from '@/lib/aspectFit'

/**
 * 窗口录制固定画布归一化 Worker（kr-01 window-capture-fixed-canvas，Task 3.1）：
 * MediaStreamTrackProcessor 逐帧读原始窗口帧 → 等比居中绘制到固定 OffscreenCanvas
 * → VideoTrackGenerator 产出恒定尺寸的生成轨交给 MediaRecorder。
 * - 保留输入帧时间戳并保证单调递增；输入/输出帧均显式 close()
 * - writer.write 的 WritableStream 背压即队列上限，不无限堆积
 * - 窗口最小化/暂停产帧时以 ~10fps 重复最后画面，保持输出时间轴连续
 * 录制期只做来源归一化，不生成运镜/波纹等编辑效果。
 */

export interface FixedCanvasStartMessage {
  type: 'start'
  track: MediaStreamTrack
  width: number
  height: number
}

export type FixedCanvasWorkerOut =
  | { type: 'track'; track: MediaStreamTrack }
  | { type: 'error'; message: string }

// lib.dom（TS 5.5）尚无这两个 WebCodecs 流桥接 API 的声明，最小化本地声明
interface MediaStreamTrackProcessorLike {
  readable: ReadableStream<VideoFrame>
}
interface VideoTrackGeneratorLike {
  track: MediaStreamTrack
  writable: WritableStream<VideoFrame>
}
const TrackProcessorCtor = (
  globalThis as {
    MediaStreamTrackProcessor?: new (init: { track: MediaStreamTrack }) => MediaStreamTrackProcessorLike
  }
).MediaStreamTrackProcessor
const TrackGeneratorCtor = (
  globalThis as { VideoTrackGenerator?: new () => VideoTrackGeneratorLike }
).VideoTrackGenerator

const scope = self as unknown as {
  postMessage(message: FixedCanvasWorkerOut, transfer?: Transferable[]): void
  onmessage: ((event: MessageEvent<FixedCanvasStartMessage>) => void) | null
}

scope.onmessage = (event) => {
  const msg = event.data
  if (msg.type !== 'start') return
  run(msg).catch((err: unknown) => {
    try {
      msg.track.stop()
    } catch {
      // 轨已结束
    }
    scope.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err)
    })
  })
}

async function run(msg: FixedCanvasStartMessage): Promise<void> {
  const missing = [
    TrackProcessorCtor ? null : 'MediaStreamTrackProcessor',
    TrackGeneratorCtor ? null : 'VideoTrackGenerator',
    typeof OffscreenCanvas !== 'undefined' ? null : 'OffscreenCanvas'
  ].filter(Boolean)
  // 后面的 ctor 非空判断同时让 TS 收窄类型（missing 列表只用于报错文案）
  if (missing.length > 0 || !TrackProcessorCtor || !TrackGeneratorCtor) {
    throw new Error(`当前环境不支持窗口固定画布录制（Worker 缺少 ${missing.join('/')}）`)
  }
  const canvas = new OffscreenCanvas(msg.width, msg.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('OffscreenCanvas 2d 上下文不可用')

  const processor = new TrackProcessorCtor({ track: msg.track })
  const generator = new TrackGeneratorCtor()
  const writer = generator.writable.getWriter()
  scope.postMessage({ type: 'track', track: generator.track }, [generator.track as unknown as Transferable])

  let lastTimestamp = -1 // μs，输出时间戳单调递增
  let hasContent = false
  let lastEmitPerf = performance.now()
  let closing = false
  let watchdogPending = false
  let emitQueue = Promise.resolve()

  const emit = (timestampUs: number): Promise<void> => {
    emitQueue = emitQueue.then(async () => {
      if (closing) return
      const ts = Math.max(timestampUs, lastTimestamp + 1)
      const frame = new VideoFrame(canvas, { timestamp: ts })
      lastTimestamp = ts
      lastEmitPerf = performance.now()
      try {
        await writer.write(frame)
      } finally {
        frame.close()
      }
    })
    return emitQueue
  }

  const watchdog = setInterval(() => {
    if (!hasContent) return
    const idleMs = performance.now() - lastEmitPerf
    if (idleMs <= 120 || watchdogPending) return
    watchdogPending = true
    void emit(lastTimestamp + Math.round(idleMs * 1000))
      .catch(() => undefined)
      .finally(() => { watchdogPending = false })
  }, 100)

  try {
    const reader = processor.readable.getReader()
    for (;;) {
      const { value: frame, done } = await reader.read()
      if (done || !frame) break
      try {
        const { displayWidth: w, displayHeight: h, timestamp } = frame
        // 零尺寸帧（最小化瞬间等）不绘制，沿用画布已有内容
        if (w > 0 && h > 0) {
          const placement = fitRectCentered(canvas.width, canvas.height, w, h)
          // 留白区透明（VP9 alpha），预览/导出时透出编辑器背景色而不是黑边
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(frame, placement.x, placement.y, placement.width, placement.height)
          hasContent = true
        }
        await emit(timestamp)
      } finally {
        frame.close()
      }
    }
  } finally {
    clearInterval(watchdog)
    closing = true
    await emitQueue.catch(() => undefined)
    try {
      msg.track.stop()
    } catch {
      // 轨已结束
    }
    try {
      await writer.close()
    } catch {
      // 生成轨已关闭
    }
  }
}
