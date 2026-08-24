const WARMUP_MS = 3000
const SAMPLE_WINDOW_MS = 2000
const MIN_PRESENTATION_RATIO = 0.7

export interface PreviewPerformanceIssue {
  actualFps: number
  expectedFps: number
}

/** rVFC 调用方驱动的纯计数器；不创建额外帧循环，也不持有 React 状态。 */
export class PreviewPerformanceMonitor {
  private warmupStartedAt: number | null = null
  private windowStartedAt: number | null = null
  private windowFrames = 0
  private lastNowMs: number | null = null
  private lastMediaMs: number | null = null

  reset(): void {
    this.warmupStartedAt = null
    this.windowStartedAt = null
    this.windowFrames = 0
    this.lastNowMs = null
    this.lastMediaMs = null
  }

  sample(nowMs: number, mediaMs: number, expectedFps: number): PreviewPerformanceIssue | null {
    if (![nowMs, mediaMs, expectedFps].every(Number.isFinite) || expectedFps <= 0) {
      this.reset()
      return null
    }
    if (this.isDiscontinuous(nowMs, mediaMs, expectedFps)) this.reset()
    this.lastNowMs = nowMs
    this.lastMediaMs = mediaMs
    if (this.warmupStartedAt === null) this.warmupStartedAt = nowMs
    if (nowMs - this.warmupStartedAt < WARMUP_MS) return null
    if (this.windowStartedAt === null) this.windowStartedAt = nowMs
    this.windowFrames += 1
    const elapsedMs = nowMs - this.windowStartedAt
    if (elapsedMs < SAMPLE_WINDOW_MS) return null
    const actualFps = (this.windowFrames * 1000) / Math.max(1, elapsedMs)
    this.windowStartedAt = nowMs
    this.windowFrames = 0
    return actualFps / expectedFps < MIN_PRESENTATION_RATIO
      ? { actualFps, expectedFps }
      : null
  }

  private isDiscontinuous(nowMs: number, mediaMs: number, expectedFps: number): boolean {
    if (this.lastNowMs === null || this.lastMediaMs === null) return false
    const wallDelta = nowMs - this.lastNowMs
    const mediaDelta = mediaMs - this.lastMediaMs
    const maxGap = Math.max(250, (4000 / expectedFps))
    return wallDelta < 0 || wallDelta > maxGap || mediaDelta < 0 ||
      Math.abs(mediaDelta - wallDelta) > maxGap
  }
}
