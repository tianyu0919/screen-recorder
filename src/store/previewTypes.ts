import type { CameraKeyframe, RecordingSession } from '@shared/types'
import type { EditSaveState, MotionEffect, RenderSettings, TtsEditSettings } from '@shared/edit'
import type { TtsJobStatus, TtsVoiceListItem } from '@shared/tts'
import type { Timeline } from '@/timeline/types'
import type { MotionParams } from '@/timeline/keyframes'
import type { CutRange } from '@/timeline/cuts'
import type { RipplePoint } from '@/render/types'
import type { CustomClip } from '@/lib/audioClip'
import type { DisplayKeyPrompt } from '@/timeline/keyPrompts'
import type {
  CaptionModelInfo,
  CaptionPosition,
  CaptionStyle,
  CaptionsDocument,
  TranscriptionJobState
} from '@shared/captions'
import type { SessionThumbnailInfo } from '@shared/sessionThumbnail'

export interface PreviewSession {
  session: RecordingSession
  timeline: Timeline
  videoUrl: string
  audioUrl: string | null
  systemAudioUrl: string | null
  systemAudioOffsetSec: number
  /** TTS 派生轨 media:// URL（edit.json tts.enabled 且派生文件存在时非空） */
  ttsDerivedUrl: string | null
}

/** mic 轨位播放源：TTS 启用且有派生轨时用派生轨，否则用原声 mic.wav（kr-08）。 */
export function selectMicSlotUrl(
  state: Pick<PreviewState, 'current' | 'ttsSettings'>
): string | null {
  const current = state.current
  if (!current) return null
  return state.ttsSettings?.enabled && current.ttsDerivedUrl
    ? current.ttsDerivedUrl
    : current.audioUrl
}

export interface PreviewState {
  sessions: RecordingSession[]
  sessionsLoaded: boolean
  loading: boolean
  loadError: string | null
  current: PreviewSession | null
  motionParams: MotionParams
  motionEnabled: boolean
  keyframes: CameraKeyframe[]
  ripples: RipplePoint[]
  motionEffects: MotionEffect[]
  selectedMotionId: string | null
  keyPrompts: DisplayKeyPrompt[]
  manualKeyPrompts: Array<{ id: string; t: number; keys: string[] }>
  hiddenRecordedKeyIndices: number[]
  keyboardOverlay: { x: number; y: number }
  saveState: EditSaveState
  editRevision: number
  editLoadError: string | null
  cuts: CutRange[]
  sourceDurationMs: number | null
  audioGain: { mic: number; system: number }
  audioMute: { mic: boolean; system: boolean }
  renderSettings: RenderSettings
  customClips: CustomClip[]
  clipError: string | null
  captions: CaptionsDocument | null
  captionsError: string | null
  captionsEnabled: boolean
  captionsSaveState: 'idle' | 'pending' | 'saving' | 'saved' | 'error'
  captionModels: CaptionModelInfo[]
  transcription: TranscriptionJobState
  selectedCaptionId: string | null
  captionPositionMode: 'global' | 'segment'
  ttsSettings: TtsEditSettings | null
  ttsVoices: TtsVoiceListItem[]
  ttsJob: TtsJobStatus | null

  loadSessions(refresh?: boolean): Promise<void>
  trashSession(sessionId: string): Promise<void>
  restoreSession(sessionId: string): Promise<void>
  deleteSessionPermanent(sessionId: string): Promise<void>
  emptyTrash(): Promise<void>
  removeMissingSession(sessionId: string): Promise<void>
  setSessionThumbnail(sessionId: string, thumbnail: SessionThumbnailInfo): void
  renameSession(displayName: string): Promise<string>
  openSession(sessionId: string): Promise<void>
  closeSession(): void
  setMotionParams(patch: Partial<MotionParams>): void
  setMotionEnabled(enabled: boolean): void
  setSegmentZoom(id: string, zoom: number): void
  resetSegmentZoom(id: string): void
  selectMotionEffect(id: string | null): void
  addMotionEffect(tMs: number): string | null
  moveMotionEffect(id: string, startMs: number, commit?: boolean, anchorMs?: number): void
  resizeMotionEffect(
    id: string,
    edge: 'start' | 'end',
    tMs: number,
    commit?: boolean,
    anchorMs?: number
  ): void
  removeMotionEffect(id: string): void
  addManualKeyPrompt(tMs: number, keys: string[]): void
  removeKeyPrompt(id: string): void
  setKeyboardOverlay(position: { x: number; y: number }, commit?: boolean): void
  commitEdit(): void
  retrySave(): void
  addCut(range: CutRange): void
  removeCut(index: number): void
  clearCuts(): void
  setSourceDurationMs(durationMs: number): void
  setAudioGain(patch: Partial<{ mic: number; system: number }>): void
  setAudioMuted(track: 'mic' | 'system', muted: boolean): void
  addCustomClip(offsetMs?: number): Promise<void>
  removeCustomClip(id: string): void
  setClipOffset(id: string, offsetMs: number): void
  setClipTrim(
    id: string,
    patch: Partial<Pick<CustomClip, 'offsetMs' | 'trimStartMs' | 'trimEndMs'>>
  ): void
  setClipGain(id: string, gain: number): void
  setClipMuted(id: string, muted: boolean): void
  setRenderSettings(patch: Partial<RenderSettings>): void
  startTranscription(language: 'auto' | 'zh' | 'en', modelId: string, replaceExisting: boolean): Promise<void>
  cancelTranscription(): Promise<void>
  refreshCaptionModels(): Promise<void>
  importCaptionModel(): Promise<CaptionModelInfo | null>
  deleteCaptionModel(modelId: string): Promise<void>
  selectCaption(id: string | null): void
  setCaptionPositionMode(mode: 'global' | 'segment'): void
  updateCaptionText(id: string, text: string): void
  updateCaptionRange(id: string, startMs: number, endMs: number, commit?: boolean): void
  splitCaption(id: string, atMs: number): void
  mergeCaptionWithNext(id: string): void
  removeCaption(id: string): void
  setCaptionStyle(patch: Partial<CaptionStyle>): void
  setCaptionPosition(position: CaptionPosition, segmentOnly: boolean, commit?: boolean): void
  setCaptionsEnabled(enabled: boolean, language?: 'auto' | 'zh' | 'en', modelId?: string): void
  retryCaptionSave(): void
  addCaptionAt(tMs: number): void
  importCaptionsSrt(source: string): void
  exportCaptionsSrt(): Promise<void>
  refreshTtsVoices(): Promise<void>
  startTtsGeneration(voiceId: string): Promise<void>
  cancelTtsGeneration(): Promise<void>
  setTtsEnabled(enabled: boolean): void
  previewTtsVoice(voiceId: string, language: 'zh' | 'en'): Promise<void>
  importTtsModel(): Promise<void>
  deleteTtsModel(modelKey: string): Promise<void>
}
