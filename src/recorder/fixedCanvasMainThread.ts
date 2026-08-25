import { fitRectCentered } from '@/lib/aspectFit'
import type { FixedCanvasTrackHandle } from './fixedCanvas'
import { maskWindowFrameCorners } from './windowFrameMask'

/**
 * 固定画布归一化的主线程降级路径（kr-01 window-capture-fixed-canvas）：
 * 当 Chromium 不允许 MediaStreamTrack 进入 Worker（不可 transfer/clone）时使用。
 * 隐藏 <video> 播放采集流 → rVFC 逐帧等比居中绘制到固定 <canvas>
 * → canvas.captureStream(0) 手动帧输出给 MediaRecorder。
 * 功能与 Worker 管线等价；代价是合成在主线程（GPU 加速 drawImage，开销可控）。
 * 最小化/暂停产帧时以看门狗重复最后画面，保持输出时间轴连续。
 */
export async function createMainThreadFixedCanvasTrack(
  sourceTrack: MediaStreamTrack,
  size: { width: number; height: number },
  cornerRadiusPx = 0
): Promise<FixedCanvasTrackHandle> {
  if (typeof document === 'undefined' || !HTMLCanvasElement.prototype.captureStream) {
    throw new Error('当前环境不支持主线程固定画布（缺少 canvas.captureStream）')
  }
  const video = document.createElement('video')
  video.muted = true
  video.srcObject = new MediaStream([sourceTrack])
  await video.play()
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d 上下文不可用')
  const outStream = canvas.captureStream(0)
  const outTrack = outStream.getVideoTracks()[0] as MediaStreamTrack & {
    requestFrame?: () => void
  }
  let hasContent = false
  let lastDrawPerf = performance.now()
  let rVfcHandle: number | null = null
  const draw = (): void => {
    const w = video.videoWidth
    const h = video.videoHeight
    // 零尺寸（最小化瞬间等）沿用画布已有内容，不产生非法尺寸
    if (w > 0 && h > 0) {
      const placement = fitRectCentered(canvas.width, canvas.height, w, h)
      // 留白区透明（VP9 alpha），预览/导出时透出编辑器背景色而不是黑边
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(video, placement.x, placement.y, placement.width, placement.height)
      maskWindowFrameCorners(ctx, placement, cornerRadiusPx)
      hasContent = true
    }
    if (hasContent) {
      lastDrawPerf = performance.now()
      outTrack.requestFrame?.()
    }
  }
  const onFrame = (): void => {
    draw()
    rVfcHandle = video.requestVideoFrameCallback(onFrame)
  }
  rVfcHandle = video.requestVideoFrameCallback(onFrame)
  // rVFC 在窗口最小化/帧停滞时不触发，看门狗以 ~10fps 补帧
  const watchdog = setInterval(() => {
    if (hasContent && performance.now() - lastDrawPerf > 120) draw()
  }, 100)
  return {
    track: outTrack,
    dispose: () => {
      if (rVfcHandle !== null) video.cancelVideoFrameCallback(rVfcHandle)
      clearInterval(watchdog)
      try {
        outTrack.stop()
      } catch {
        // 轨已结束
      }
      video.pause()
      video.srcObject = null
    }
  }
}
