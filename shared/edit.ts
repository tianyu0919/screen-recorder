import type { CameraState } from './types'

export interface MotionParamsEdit {
  targetZoom: number
  dwellMs: number
  returnThresholdMs: number
  leadMs: number
}

export interface MotionEffect {
  id: string
  origin: 'recorded-click' | 'manual'
  startMs: number
  endMs: number
  zoom: number
  /** 不可变 events.json.clicks 的原数组索引。手动运镜为空。 */
  sourceClickIndices: number[]
  /** 相对 startMs 的波纹时间；与 sourceClickIndices 一一对应。 */
  rippleOffsetsMs: number[]
  /** mouseTrack 缺失时使用；正常情况由开始时间实时采样。 */
  fallbackFocus?: Pick<CameraState, 'x' | 'y'>
}

export interface ManualKeyPrompt {
  id: string
  t: number
  keys: string[]
}

export interface PersistedAudioClipV1 {
  id: string
  name: string
  assetFile: string
  offsetMs: number
  gain: number
  sourceDurationMs: number
  trimStartMs: number
  trimEndMs: number
  peaks: number[]
}

export interface PersistedAudioClip extends PersistedAudioClipV1 {
  muted: boolean
}

export interface RenderSettings {
  backgroundEnabled: boolean
  backgroundColor: string
  backgroundPaddingPercent: number
}

export const DEFAULT_BACKGROUND_PADDING_PERCENT = 6
export const MIN_BACKGROUND_PADDING_PERCENT = 0
export const MAX_BACKGROUND_PADDING_PERCENT = 20

export function normalizeBackgroundPaddingPercent(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(MAX_BACKGROUND_PADDING_PERCENT, Math.max(MIN_BACKGROUND_PADDING_PERCENT, value))
    : DEFAULT_BACKGROUND_PADDING_PERCENT
}

export interface EditDocumentV1 {
  version: 1
  updatedAt: string
  motionParams: MotionParamsEdit
  motionEffects: MotionEffect[]
  manualKeyPrompts: ManualKeyPrompt[]
  hiddenRecordedKeyIndices: number[]
  cuts: Array<{ startMs: number; endMs: number }>
  audioGain: { mic: number; system: number }
  customAudio: PersistedAudioClipV1[]
  keyboardOverlay: { x: number; y: number }
}

export interface EditDocumentV2 {
  version: 2
  updatedAt: string
  motionEnabled: boolean
  motionParams: MotionParamsEdit
  motionEffects: MotionEffect[]
  manualKeyPrompts: ManualKeyPrompt[]
  hiddenRecordedKeyIndices: number[]
  cuts: Array<{ startMs: number; endMs: number }>
  audioGain: { mic: number; system: number }
  audioMute: { mic: boolean; system: boolean }
  customAudio: PersistedAudioClip[]
  keyboardOverlay: { x: number; y: number }
  renderSettings: RenderSettings
}

export type EditDocument = EditDocumentV2

export type EditSaveState =
  | { kind: 'idle' }
  | { kind: 'saving'; revision: number }
  | { kind: 'saved'; revision: number }
  | { kind: 'error'; revision: number; message: string }

export interface SessionEditSaveResult {
  updatedAt: number
}
