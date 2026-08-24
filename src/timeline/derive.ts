import type { CameraKeyframe } from '@shared/types'
import type { RecordingEventsV2 } from '@shared/eventsV2'
import type { MotionEffect } from '@shared/edit'
import { clampCameraToCanvas } from './coords'
import { generateCameraKeyframes, type MotionParams } from './keyframes'
import { buildZoomSegments } from './segments'
import type { Timeline } from './types'
import type { RipplePoint } from '@/render/types'
import { addCursorFollowKeyframes } from './cursorFollow'
import { keyframesFromMotionEffects, ripplesFromMotionEffects } from './motionEffects'
import { screenPointToCanvas } from './windowGeometry'

/** 只在内存中裁掉真实视频片尾外的采集事件；events.json 原文件保持不变。 */
export function eventsWithinDuration(
  events: RecordingEventsV2,
  durationMs: number
): RecordingEventsV2 {
  if (!Number.isFinite(durationMs)) return events
  const within = (t: number): boolean => t <= durationMs
  return {
    ...events,
    mouseTrack: events.mouseTrack.filter((p) => within(p[0])),
    clicks: events.clicks.filter((event) => within(event.t)),
    keys: events.keys.filter((event) => within(event.t))
  }
}

/** timeline + 运镜参数 → 预览/导出共用关键帧与点击波纹。 */
export function deriveTimelineEffects(
  timeline: Timeline,
  params: MotionParams,
  overrides: Record<number, number>,
  durationMs = Infinity,
  motionEffects?: MotionEffect[]
): { keyframes: CameraKeyframe[]; ripples: RipplePoint[] } {
  const events = eventsWithinDuration(timeline.events, durationMs)
  const effects = motionEffects?.flatMap((effect) => {
    if (effect.startMs >= durationMs) return []
    return [{ ...effect, endMs: Math.min(effect.endMs, durationMs) }]
  })
  let keyframes = effects
    ? keyframesFromMotionEffects(effects, events, timeline.canvas)
    : generateCameraKeyframes(events, timeline.canvas, params)
  if (!effects && Object.keys(overrides).length > 0) {
    const segments = buildZoomSegments(keyframes, durationMs)
    const zoomOf = new Map<number, number>()
    for (const segment of segments) {
      const zoom = overrides[segment.startMs]
      if (zoom !== undefined) zoomOf.set(segment.startMs, zoom)
    }
    keyframes = keyframes.map((keyframe) => {
      if (keyframe.target.zoom <= 1.05) return keyframe
      const segment = segments.find(
        (candidate) => keyframe.t >= candidate.startMs && keyframe.t < candidate.endMs
      )
      const zoom = segment ? zoomOf.get(segment.startMs) : undefined
      return zoom === undefined
        ? keyframe
        : {
            ...keyframe,
            target: clampCameraToCanvas({ ...keyframe.target, zoom }, timeline.canvas)
          }
    })
  }
  // 片段倍率覆盖先落到 zoom，再按最终倍率计算即时跟随的边缘钳制。
  keyframes = addCursorFollowKeyframes(keyframes, events, timeline.canvas)
  return {
    keyframes,
    ripples: effects
      ? ripplesFromMotionEffects(effects, events, timeline.canvas)
      : events.clicks.flatMap((click) => {
          // 窗口录制：当时刻窗口外的点击不生成波纹
          const point = screenPointToCanvas(events, click.t, click.x, click.y)
          return point ? [{ t: click.t, ...point }] : []
        })
  }
}
