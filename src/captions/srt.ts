import type { CaptionSegment } from '@shared/captions'
import type { CutRange } from '@/timeline/cuts'
import { mapCaptionsThroughCuts } from './operations'

function timestamp(ms: number): string {
  const value = Math.max(0, Math.round(ms))
  const hours = Math.floor(value / 3_600_000)
  const minutes = Math.floor(value % 3_600_000 / 60_000)
  const seconds = Math.floor(value % 60_000 / 1000)
  const millis = value % 1000
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`
}

export function serializeSrt(segments: CaptionSegment[], cuts: CutRange[], durationMs: number): string {
  return mapCaptionsThroughCuts(segments, cuts, durationMs)
    .map((segment, index) => `${index + 1}\n${timestamp(segment.startMs)} --> ${timestamp(segment.endMs)}\n${segment.text.trim()}\n`)
    .join('\n')
}
