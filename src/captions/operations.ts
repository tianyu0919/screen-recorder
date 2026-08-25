import type { CaptionSegment, CaptionsDocument } from '@shared/captions'
import type { CutRange } from '@/timeline/cuts'
import { normalizeCuts, sourceToOutputMs } from '@/timeline/cuts'
export { clampCaptionSegment, normalizeCaptionSegments } from '@shared/captionSegments'

const MIN_SEGMENT_MS = 100

export function splitCaptionSegment(segment: CaptionSegment, atMs: number): CaptionSegment[] {
  const split = Math.min(segment.endMs - MIN_SEGMENT_MS, Math.max(segment.startMs + MIN_SEGMENT_MS, atMs))
  if (split <= segment.startMs || split >= segment.endMs) return [segment]
  return [
    { ...segment, id: crypto.randomUUID(), endMs: split },
    { ...segment, id: crypto.randomUUID(), startMs: split }
  ]
}

export function mergeCaptionSegments(first: CaptionSegment, second: CaptionSegment): CaptionSegment {
  return {
    ...first,
    startMs: Math.min(first.startMs, second.startMs),
    endMs: Math.max(first.endMs, second.endMs),
    text: `${first.text.trim()} ${second.text.trim()}`.trim()
  }
}

export function activeCaption(document: CaptionsDocument | null, sourceMs: number): CaptionSegment | null {
  if (!document) return null
  let low = 0, high = document.segments.length - 1
  while (low <= high) {
    const middle = (low + high) >>> 1
    const segment = document.segments[middle]
    if (sourceMs < segment.startMs) high = middle - 1
    else if (sourceMs >= segment.endMs) low = middle + 1
    else return segment
  }
  return null
}

export interface OutputCaptionSegment extends CaptionSegment {
  sourceId: string
}

export function mapCaptionsThroughCuts(
  segments: CaptionSegment[],
  cuts: CutRange[],
  durationMs: number
): OutputCaptionSegment[] {
  const normalizedCuts = normalizeCuts(cuts, durationMs)
  const kept: Array<{ startMs: number; endMs: number }> = []
  let cursor = 0
  for (const cut of normalizedCuts) {
    if (cursor < cut.startMs) kept.push({ startMs: cursor, endMs: cut.startMs })
    cursor = cut.endMs
  }
  if (cursor < durationMs) kept.push({ startMs: cursor, endMs: durationMs })
  return segments.flatMap((segment) => kept.flatMap((range) => {
    const startMs = Math.max(segment.startMs, range.startMs)
    const endMs = Math.min(segment.endMs, range.endMs)
    if (endMs - startMs < 1) return []
    return [{
      ...segment,
      id: `${segment.id}:${startMs}`,
      sourceId: segment.id,
      startMs: sourceToOutputMs(startMs, normalizedCuts),
      endMs: sourceToOutputMs(endMs, normalizedCuts)
    }]
  }))
}
