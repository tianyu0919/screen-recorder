export interface SessionThumbnailInfo {
  url: string
  durationMs: number | null
}

export interface SaveSessionThumbnailRequest {
  sessionId: string
  webp: ArrayBuffer
  durationMs: number | null
}
