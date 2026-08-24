import type { CameraKeyframe } from '@shared/types'
import type { CanvasSize } from '@/timeline/types'
import type { RenderInfo, RipplePoint } from '@/render/types'
import type { CutRange } from '@/timeline/cuts'
import type { DisplayKeyPrompt } from '@/timeline/keyPrompts'
import type { RenderSettings } from '@shared/edit'

export interface PlaybackOptions {
  /** 录屏源分辨率（相机坐标系基准）。 */
  canvasSize: CanvasSize | null
  /** 预览 WebGL backing 分辨率；null 表示舞台尚未测量。 */
  renderOutputSize: CanvasSize | null
  renderSettings: RenderSettings
  keyframes: CameraKeyframe[]
  ripples: RipplePoint[]
  keyPrompts: DisplayKeyPrompt[]
  keyboardOverlay: { x: number; y: number }
  cuts: CutRange[]
  fallbackDurationMs: number
  sourceFps: number
  performanceMonitoring: boolean
  onPerformanceIssue(): void
}

export interface Playback {
  playing: boolean
  /** 低频 React UI 时间；逐帧播放头通过 subscribeCurrentMs 直接更新 DOM。 */
  currentMs: number
  durationMs: number
  renderInfo: RenderInfo | null
  playbackError: string | null
  togglePlay(): void
  seekTo(ms: number): void
  subscribeCurrentMs(listener: (currentMs: number) => void): () => void
}
