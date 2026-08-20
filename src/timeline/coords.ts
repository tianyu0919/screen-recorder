import type { CameraState, RecordingEvents } from '@shared/types'
import type { CanvasSize } from './types'

/**
 * 坐标换算与画布钳制（Task 1.2）：
 * events.json 的事件坐标是屏幕坐标系（物理像素），
 * 画布坐标 = 视频像素坐标，即减去 display.bounds 原点后乘 scaleFactor。
 */

/** 屏幕坐标 → 画布（视频像素）坐标 */
export function displayToCanvas(
  display: RecordingEvents['display'],
  x: number,
  y: number
): { x: number; y: number } {
  return {
    x: (x - display.bounds[0]) * display.scaleFactor,
    y: (y - display.bounds[1]) * display.scaleFactor
  }
}

/**
 * 相机边缘钳制：缩放后视口不超出画布（缩放出界保护）。
 * 视口中心点 x/y 被限制在 [半视口, 画布 - 半视口]；zoom 不低于 1（1.0x = 全景）。
 */
export function clampCameraToCanvas(state: CameraState, canvas: CanvasSize): CameraState {
  const zoom = Math.max(1, state.zoom)
  const halfW = canvas.width / (2 * zoom)
  const halfH = canvas.height / (2 * zoom)
  return {
    x: Math.min(Math.max(state.x, halfW), canvas.width - halfW),
    y: Math.min(Math.max(state.y, halfH), canvas.height - halfH),
    zoom
  }
}
