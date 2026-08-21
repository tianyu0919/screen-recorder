import type { CameraKeyframe, RecordingEvents } from '@shared/types'
import type { MotionEffect } from '@shared/edit'
import { clampCameraToCanvas, displayToCanvas } from './coords'
import { generateCameraKeyframes, type MotionParams } from './keyframes'
import { buildZoomSegments } from './segments'
import type { CanvasSize } from './types'
import type { RipplePoint } from '@/render/types'

export const MIN_MOTION_MS = 300
export const MOTION_SNAP_MS = 100
const MAGNET_MS = 120

function snapMs(value: number, anchors: number[] = []): number {
  const grid = Math.round(value / MOTION_SNAP_MS) * MOTION_SNAP_MS
  let best = grid
  let distance = MAGNET_MS + 1
  for (const anchor of anchors) {
    const nextDistance = Math.abs(value - anchor)
    if (nextDistance <= MAGNET_MS && nextDistance < distance) {
      best = anchor
      distance = nextDistance
    }
  }
  return Math.max(0, best)
}

/** 源时间点最近的鼠标位置；轨迹缺失时回退画布中心。 */
export function mouseCanvasPointAt(
  events: RecordingEvents,
  tMs: number,
  canvas: CanvasSize
): { x: number; y: number } {
  const track = events.mouseTrack
  if (track.length === 0) return { x: canvas.width / 2, y: canvas.height / 2 }
  let lo = 0
  let hi = track.length - 1
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (track[mid][0] < tMs) lo = mid + 1
    else hi = mid
  }
  const after = track[lo]
  const before = track[Math.max(0, lo - 1)]
  const point = Math.abs(after[0] - tMs) < Math.abs(before[0] - tMs) ? after : before
  return displayToCanvas(events.display, point[1], point[2])
}

/** 旧会话首次打开：把既有自动关键帧片段物化为可编辑效果。 */
export function createDefaultMotionEffects(
  events: RecordingEvents,
  canvas: CanvasSize,
  params: MotionParams,
  durationMs: number
): MotionEffect[] {
  const keyframes = generateCameraKeyframes(events, canvas, params)
  return buildZoomSegments(keyframes, durationMs).flatMap((segment) => {
    const clickIndices = events.clicks.flatMap((click, index) => {
      const focusAt = Math.max(0, click.t - params.leadMs)
      return focusAt >= segment.startMs && focusAt < segment.endMs ? [index] : []
    })
    if (clickIndices.length === 0) return []
    return [
      {
        id: `auto-${clickIndices[0]}-${Math.round(segment.startMs)}`,
        origin: 'recorded-click' as const,
        startMs: segment.startMs,
        endMs: segment.endMs,
        zoom: segment.zoom,
        sourceClickIndices: clickIndices,
        rippleOffsetsMs: clickIndices.map((index) => events.clicks[index].t - segment.startMs)
      }
    ]
  })
}

export function createManualMotionEffect(
  atMs: number,
  durationMs: number,
  params: MotionParams,
  effects: MotionEffect[],
  anchors: number[] = []
): MotionEffect | null {
  const startMs = Math.min(snapMs(atMs, anchors), Math.max(0, durationMs - MIN_MOTION_MS))
  const endMs = Math.min(durationMs, startMs + Math.max(MIN_MOTION_MS, params.dwellMs))
  if (endMs - startMs < MIN_MOTION_MS) return null
  if (effects.some((effect) => startMs < effect.endMs && endMs > effect.startMs)) return null
  return {
    id: crypto.randomUUID(),
    origin: 'manual',
    startMs,
    endMs,
    zoom: params.targetZoom,
    sourceClickIndices: [],
    rippleOffsetsMs: []
  }
}

export function moveMotionEffect(
  effects: MotionEffect[],
  id: string,
  wantedStartMs: number,
  durationMs: number,
  anchors: number[] = []
): MotionEffect[] {
  const ordered = [...effects].sort((a, b) => a.startMs - b.startMs)
  const index = ordered.findIndex((effect) => effect.id === id)
  if (index < 0) return effects
  const current = ordered[index]
  const length = current.endMs - current.startMs
  const minStart = ordered[index - 1]?.endMs ?? 0
  const maxStart = (ordered[index + 1]?.startMs ?? durationMs) - length
  const startMs = Math.min(Math.max(snapMs(wantedStartMs, anchors), minStart), maxStart)
  ordered[index] = { ...current, startMs, endMs: startMs + length }
  return ordered
}

export function resizeMotionEffect(
  effects: MotionEffect[],
  id: string,
  edge: 'start' | 'end',
  wantedMs: number,
  durationMs: number,
  anchors: number[] = []
): MotionEffect[] {
  const ordered = [...effects].sort((a, b) => a.startMs - b.startMs)
  const index = ordered.findIndex((effect) => effect.id === id)
  if (index < 0) return effects
  const current = ordered[index]
  const snapped = snapMs(wantedMs, anchors)
  if (edge === 'start') {
    const min = ordered[index - 1]?.endMs ?? 0
    const startMs = Math.min(Math.max(snapped, min), current.endMs - MIN_MOTION_MS)
    ordered[index] = { ...current, startMs }
  } else {
    const max = ordered[index + 1]?.startMs ?? durationMs
    const endMs = Math.max(Math.min(snapped, max), current.startMs + MIN_MOTION_MS)
    ordered[index] = { ...current, endMs }
  }
  return ordered
}

export function keyframesFromMotionEffects(
  effects: MotionEffect[],
  events: RecordingEvents,
  canvas: CanvasSize
): CameraKeyframe[] {
  const full = { x: canvas.width / 2, y: canvas.height / 2, zoom: 1 }
  const keyframes: CameraKeyframe[] = [{ t: 0, target: full }]
  for (const effect of [...effects].sort((a, b) => a.startMs - b.startMs)) {
    const focus = mouseCanvasPointAt(events, effect.startMs, canvas)
    keyframes.push({
      t: effect.startMs,
      target: clampCameraToCanvas({ ...focus, zoom: effect.zoom }, canvas)
    })
    for (const offset of effect.rippleOffsetsMs.slice(1)) {
      const t = effect.startMs + offset
      if (t <= effect.startMs || t >= effect.endMs) continue
      const next = mouseCanvasPointAt(events, t, canvas)
      keyframes.push({ t, target: clampCameraToCanvas({ ...next, zoom: effect.zoom }, canvas) })
    }
    keyframes.push({ t: effect.endMs, target: full })
  }
  return keyframes.sort((a, b) => a.t - b.t)
}

export function ripplesFromMotionEffects(
  effects: MotionEffect[],
  events: RecordingEvents,
  canvas: CanvasSize
): RipplePoint[] {
  return effects.flatMap((effect) =>
    effect.sourceClickIndices.flatMap((_, index) => {
      const offset = effect.rippleOffsetsMs[index]
      if (offset === undefined) return []
      const t = effect.startMs + offset
      return [{ t, ...mouseCanvasPointAt(events, t, canvas) }]
    })
  )
}
