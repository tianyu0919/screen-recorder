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

export type EditDocument = EditDocumentV3

/** TTS 配音设置（kr-08-tts-dubbing）。文档缺省 tts 字段 = TTS 关闭。 */
export interface TtsEditSettings {
  enabled: boolean
  voiceId: string
  engineVersion: string
  /** 会话目录内派生轨文件名（tts-<derivedKey 前 8 位>.wav）；enabled 时必须存在。 */
  derivedFile?: string
  /** 整轨指纹：sha1(各段 cacheKey + 时间窗 + 引擎/音色版本)；失配视为缓存失效。 */
  derivedKey?: string
  /** 生成时变速超 ±20% 阈值的字幕段 id（UI 溢出标记持久化）。 */
  overflowSegmentIds?: string[]
}

export interface EditDocumentV3 extends Omit<EditDocumentV2, 'version'> {
  version: 3
  tts?: TtsEditSettings
}

/**
 * mic 轨位源解析（kr-08）：TTS 启用且有派生轨引用时返回派生文件名，否则 'mic.wav'。
 * 预览（media:// URL 选择）与导出（fetchSessionWav 文件名）必须共用此函数；
 * 文件实际缺失由加载端检测并回退（预览提示重新生成，导出禁止静默不一致）。
 */
export function resolveMicSlotFile(doc: Pick<EditDocumentV3, 'tts'>): string {
  return doc.tts?.enabled && doc.tts.derivedFile ? doc.tts.derivedFile : 'mic.wav'
}

/** 会话内音频文件名的安全校验（防路径穿越；派生轨/原生轨共用）。 */
export function isSafeSessionAudioFile(file: string): boolean {
  return /^[\w.-]+$/.test(file) && !file.includes('..')
}

export type EditSaveState =
  | { kind: 'idle' }
  | { kind: 'saving'; revision: number }
  | { kind: 'saved'; revision: number }
  | { kind: 'error'; revision: number; message: string }

export interface SessionEditSaveResult {
  updatedAt: number
}
