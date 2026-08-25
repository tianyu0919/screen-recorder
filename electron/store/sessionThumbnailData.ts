export const MAX_THUMBNAIL_BYTES = 1024 * 1024

export interface ThumbnailMetadata {
  version: 1
  sessionId: string
  durationMs: number | null
  sourceSize: number
  sourceMtimeMs: number
  updatedAt: string
}

export function isWebp(value: Uint8Array): boolean {
  return value.length >= 12 && ascii(value, 0, 4) === 'RIFF' && ascii(value, 8, 12) === 'WEBP'
}

export function normalizeThumbnailDuration(value: number | null): number | null {
  return value !== null && Number.isFinite(value) && value > 0 ? Math.round(value) : null
}

export function matchesThumbnailSource(
  metadata: ThumbnailMetadata,
  sessionId: string,
  source: { size: number; mtimeMs: number },
  imageSize: number
): boolean {
  return metadata.version === 1 && metadata.sessionId === sessionId &&
    metadata.sourceSize === source.size && metadata.sourceMtimeMs === source.mtimeMs &&
    imageSize > 0 && imageSize <= MAX_THUMBNAIL_BYTES
}

function ascii(value: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...value.subarray(start, end))
}
