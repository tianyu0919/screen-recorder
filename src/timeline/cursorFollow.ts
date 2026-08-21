import type { CameraKeyframe, RecordingEvents } from '@shared/types'
import { clampCameraToCanvas, displayToCanvas } from './coords'
import { buildZoomSegments } from './segments'
import type { CanvasSize } from './types'

export interface CursorFollowOptions {
  safeZoneRatio: number
  sampleIntervalMs: number
  minTargetMovePx: number
  zoomThreshold: number
}

export const DEFAULT_CURSOR_FOLLOW: CursorFollowOptions = {
  safeZoneRatio: 0.4,
  sampleIntervalMs: 80,
  minTargetMovePx: 8,
  zoomThreshold: 1.05
}

function targetInsideSafeZone(
  center: { x: number; y: number },
  cursor: { x: number; y: number },
  zoom: number,
  canvas: CanvasSize,
  safeZoneRatio: number
): { x: number; y: number } {
  const halfSafeWidth = (canvas.width / (2 * zoom)) * safeZoneRatio
  const halfSafeHeight = (canvas.height / (2 * zoom)) * safeZoneRatio
  let x = center.x
  let y = center.y
  if (cursor.x < center.x - halfSafeWidth) x = cursor.x + halfSafeWidth
  else if (cursor.x > center.x + halfSafeWidth) x = cursor.x - halfSafeWidth
  if (cursor.y < center.y - halfSafeHeight) y = cursor.y + halfSafeHeight
  else if (cursor.y > center.y + halfSafeHeight) y = cursor.y - halfSafeHeight
  return { x, y }
}

function frameAt(keyframes: CameraKeyframe[], tMs: number): CameraKeyframe | null {
  for (let index = keyframes.length - 1; index >= 0; index--) {
    if (keyframes[index].t <= tMs) return keyframes[index]
  }
  return null
}

/**
 * 在点击生成的放大关键帧之间插入稀疏鼠标跟随目标。
 * 只移动 x/y，不改变 zoom 与既有回归时机；结果仍交给同一 spring 求值器平滑过渡。
 */
export function addCursorFollowKeyframes(
  keyframes: CameraKeyframe[],
  events: RecordingEvents,
  canvas: CanvasSize,
  options: CursorFollowOptions = DEFAULT_CURSOR_FOLLOW
): CameraKeyframe[] {
  if (events.mouseTrack.length === 0) return keyframes
  const base = [...keyframes].sort((a, b) => a.t - b.t)
  const track = [...events.mouseTrack].sort((a, b) => a[0] - b[0])
  const additions: CameraKeyframe[] = []
  const safeZoneRatio = Math.min(1, Math.max(0.1, options.safeZoneRatio))
  const minMove = Math.max(
    options.minTargetMovePx,
    Math.min(canvas.width, canvas.height) * 0.005
  )

  const segments = buildZoomSegments(base, Infinity)
  for (const segment of segments) {
    const focus = base.find((keyframe) => keyframe.t === segment.startMs)
    if (!focus) continue
    if (focus.target.zoom <= options.zoomThreshold || segment.endMs <= segment.startMs) continue

    let center = { x: focus.target.x, y: focus.target.y }
    let activeBaseTime = focus.t
    let lastSampleAt = -Infinity
    for (const [tMs, displayX, displayY] of track) {
      if (tMs < segment.startMs || tMs >= segment.endMs) continue
      if (tMs - lastSampleAt < options.sampleIntervalMs) continue
      lastSampleAt = tMs
      const cursor = displayToCanvas(events.display, displayX, displayY)
      if (cursor.x < 0 || cursor.x > canvas.width || cursor.y < 0 || cursor.y > canvas.height) {
        continue
      }
      const activeFrame = frameAt(base, tMs) ?? focus
      const activeZoom = activeFrame.target.zoom
      if (activeZoom <= options.zoomThreshold) continue
      if (activeFrame.t > activeBaseTime) {
        center = { x: activeFrame.target.x, y: activeFrame.target.y }
        activeBaseTime = activeFrame.t
      }
      const desired = targetInsideSafeZone(center, cursor, activeZoom, canvas, safeZoneRatio)
      const clamped = clampCameraToCanvas({ ...desired, zoom: activeZoom }, canvas)
      if (Math.hypot(clamped.x - center.x, clamped.y - center.y) < minMove) continue
      center = { x: clamped.x, y: clamped.y }
      additions.push({ t: tMs, target: clamped })
    }
  }

  if (additions.length === 0) return keyframes
  return [...base, ...additions]
    .sort((a, b) => a.t - b.t)
    .filter((keyframe, index, all) => index === all.length - 1 || keyframe.t !== all[index + 1].t)
}
