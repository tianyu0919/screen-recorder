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

export interface PersistedAudioClip {
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

export interface EditDocumentV1 {
  version: 1
  updatedAt: string
  motionParams: MotionParamsEdit
  motionEffects: MotionEffect[]
  manualKeyPrompts: ManualKeyPrompt[]
  hiddenRecordedKeyIndices: number[]
  cuts: Array<{ startMs: number; endMs: number }>
  audioGain: { mic: number; system: number }
  customAudio: PersistedAudioClip[]
  keyboardOverlay: { x: number; y: number }
}

export type EditSaveState =
  | { kind: 'idle' }
  | { kind: 'saving'; revision: number }
  | { kind: 'saved'; revision: number }
  | { kind: 'error'; revision: number; message: string }

export interface SessionEditSaveResult {
  updatedAt: number
}
