import type { CaptionSegment } from './captions'

const MIN_SEGMENT_MS = 100

export function clampCaptionSegment(segment: CaptionSegment, durationMs: number): CaptionSegment {
  const startMs = Math.min(Math.max(0, segment.startMs), Math.max(0, durationMs - MIN_SEGMENT_MS))
  const endMs = Math.min(durationMs, Math.max(startMs + MIN_SEGMENT_MS, segment.endMs))
  return { ...segment, startMs, endMs, text: segment.text.trim() }
}

export function normalizeCaptionSegments(segments: CaptionSegment[], durationMs: number): CaptionSegment[] {
  const sorted = segments
    .map((segment) => clampCaptionSegment(segment, durationMs))
    .filter((segment) => segment.text.length > 0)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)
  return sorted.map((segment, index) => {
    const previous = sorted[index - 1]
    return previous && segment.startMs < previous.endMs
      ? { ...segment, startMs: previous.endMs, endMs: Math.max(previous.endMs + MIN_SEGMENT_MS, segment.endMs) }
      : segment
  }).filter((segment) => segment.endMs <= durationMs)
}
