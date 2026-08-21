import type { RipplePoint } from '@/render/types'
import type { DisplayKeyPrompt } from './keyPrompts'

export interface TimelineEventItem {
  id: string
  t: number
  label: string
  kind: 'click' | 'key'
}

export interface EventDisplayCluster {
  id: string
  t: number
  mode: 'label' | 'dot'
  items: TimelineEventItem[]
}

export interface TimeWindow {
  startMs: number
  endMs: number
}

export function buildTimelineEventItems(
  ripples: RipplePoint[],
  keyPrompts: DisplayKeyPrompt[]
): TimelineEventItem[] {
  return [
    ...ripples.map((ripple, index) => ({
      id: `click-${index}-${Math.round(ripple.t)}`,
      t: ripple.t,
      label: '点击',
      kind: 'click' as const
    })),
    ...keyPrompts.map((prompt) => ({
      id: prompt.id,
      t: prompt.t,
      label: prompt.keys.join(' + '),
      kind: 'key' as const
    }))
  ].sort((a, b) => a.t - b.t)
}

/** 缩放微调不跨档时复用上一结果，避免滚轮每个 delta 都重分组。 */
export function eventDensityBucket(pxPerSec: number): number {
  if (!Number.isFinite(pxPerSec) || pxPerSec <= 0) return 0
  return Math.round(Math.log(pxPerSec) / Math.log(Math.SQRT2))
}

export function bufferedTimeWindow(
  scrollLeft: number,
  viewportWidth: number,
  contentWidth: number,
  durationMs: number
): TimeWindow {
  if (contentWidth <= 0 || viewportWidth <= 0) return { startMs: 0, endMs: durationMs }
  const startPx = Math.max(0, scrollLeft - viewportWidth)
  const endPx = Math.min(contentWidth, scrollLeft + viewportWidth * 2)
  return {
    startMs: (startPx / contentWidth) * durationMs,
    endMs: (endPx / contentWidth) * durationMs
  }
}

function labelWidth(label: string): number {
  return Math.max(28, Math.min(140, label.length * 7 + 12))
}

export function clusterTimelineEvents(
  items: TimelineEventItem[],
  pxPerSec: number,
  window: TimeWindow
): EventDisplayCluster[] {
  const visible = items.filter((item) => item.t >= window.startMs && item.t <= window.endMs)
  const clusters: EventDisplayCluster[] = []
  let active: TimelineEventItem[] = []
  let activeRight = -Infinity

  const flush = (): void => {
    if (active.length === 0) return
    const first = active[0]
    clusters.push({
      id: active.map((item) => item.id).join('|'),
      t: first.t,
      mode: active.length === 1 && first.kind === 'key' ? 'label' : 'dot',
      items: active
    })
    active = []
    activeRight = -Infinity
  }

  for (const item of visible) {
    const x = (item.t / 1000) * pxPerSec
    const width = item.kind === 'key' ? labelWidth(item.label) : 12
    const left = x - width / 2
    if (active.length > 0 && left < activeRight + 4) {
      active.push(item)
      activeRight = Math.max(activeRight, x + width / 2)
    } else {
      flush()
      active = [item]
      activeRight = x + width / 2
    }
  }
  flush()
  return clusters
}
