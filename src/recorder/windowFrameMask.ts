import type { Rect } from '@/render/layout'

type Canvas2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

/**
 * ScreenCaptureKit 的窗口帧包含系统圆角外沿与阴影过渡；在 Retina 原始帧中，
 * 需要约 32 DIP 才能完整覆盖其编码成黑色的角区。Windows 返回 0，保持直角。
 */
const MACOS_CAPTURE_CORNER_MASK_DIP = 32

export function windowFrameCornerRadiusPx(platform: string, pixelRatio: number): number {
  if (platform !== 'darwin') return 0
  return MACOS_CAPTURE_CORNER_MASK_DIP * Math.max(1, pixelRatio)
}

/** 用 destination-in 保留圆角矩形内部 alpha；固定画布透明留白维持不变。 */
export function maskWindowFrameCorners(ctx: Canvas2D, rect: Rect, radiusPx: number): void {
  const radius = Math.min(Math.max(0, radiusPx), rect.width / 2, rect.height / 2)
  if (radius <= 0 || rect.width <= 0 || rect.height <= 0) return
  const right = rect.x + rect.width
  const bottom = rect.y + rect.height
  ctx.save()
  ctx.globalCompositeOperation = 'destination-in'
  ctx.fillStyle = '#000000'
  ctx.beginPath()
  ctx.moveTo(rect.x + radius, rect.y)
  ctx.lineTo(right - radius, rect.y)
  ctx.arcTo(right, rect.y, right, rect.y + radius, radius)
  ctx.lineTo(right, bottom - radius)
  ctx.arcTo(right, bottom, right - radius, bottom, radius)
  ctx.lineTo(rect.x + radius, bottom)
  ctx.arcTo(rect.x, bottom, rect.x, bottom - radius, radius)
  ctx.lineTo(rect.x, rect.y + radius)
  ctx.arcTo(rect.x, rect.y, rect.x + radius, rect.y, radius)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}
