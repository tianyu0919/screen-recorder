import type { CameraKeyframe } from '@shared/types'
import type { RecordingEventsV2 } from '@shared/eventsV2'
import { clampCameraToCanvas } from './coords'
import { buildZoomSegments } from './segments'
import type { CanvasSize } from './types'
import { screenPointToCanvas } from './windowGeometry'

export interface CursorFollowOptions {
  sampleIntervalMs: number
  minTargetMovePx: number
  zoomThreshold: number
  followSpring: { stiffness: number; damping: number }
}

export const DEFAULT_CURSOR_FOLLOW: CursorFollowOptions = {
  sampleIntervalMs: 32,
  minTargetMovePx: 2,
  zoomThreshold: 1.05,
  followSpring: { stiffness: 520, damping: 42 }
}

function frameAt(keyframes: CameraKeyframe[], tMs: number): CameraKeyframe | null {
  for (let index = keyframes.length - 1; index >= 0; index--) {
    if (keyframes[index].t <= tMs) return keyframes[index]
  }
  return null
}

/**
 * 在点击生成的放大关键帧之间插入鼠标跟随目标。
 * 任意有效移动都会直接更新 x/y，仅过滤像素级抖动；快速 spring 保持连续但不拖沓。
 */
export function addCursorFollowKeyframes(
  keyframes: CameraKeyframe[],
  events: RecordingEventsV2,
  canvas: CanvasSize,
  options: CursorFollowOptions = DEFAULT_CURSOR_FOLLOW
): CameraKeyframe[] {
  if (events.mouseTrack.length === 0) return keyframes
  const base = [...keyframes].sort((a, b) => a.t - b.t)
  const track = [...events.mouseTrack].sort((a, b) => a[0] - b[0])
  const additions: CameraKeyframe[] = []
  const minMove = Math.max(0, options.minTargetMovePx)

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
      // 窗口录制：当时刻窗口外的轨迹点不跟随（坐标与波纹/运镜共用同一映射）
      const cursor = screenPointToCanvas(events, tMs, displayX, displayY)
      if (!cursor) continue
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
      const clamped = clampCameraToCanvas({ ...cursor, zoom: activeZoom }, canvas)
      if (Math.hypot(clamped.x - center.x, clamped.y - center.y) < minMove) continue
      center = { x: clamped.x, y: clamped.y }
      additions.push({ t: tMs, target: clamped, spring: options.followSpring })
    }
  }

  if (additions.length === 0) return keyframes
  return [...base, ...additions]
    .sort((a, b) => a.t - b.t)
    .filter((keyframe, index, all) => index === all.length - 1 || keyframe.t !== all[index + 1].t)
}
