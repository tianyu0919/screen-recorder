import type { CameraKeyframe, RecordingSession } from '@shared/types'
import type { EditSaveState, MotionEffect } from '@shared/edit'
import type { Timeline } from '@/timeline/types'
import type { MotionParams } from '@/timeline/keyframes'
import type { CutRange } from '@/timeline/cuts'
import type { RipplePoint } from '@/render/types'
import type { CustomClip } from '@/lib/audioClip'
import type { DisplayKeyPrompt } from '@/timeline/keyPrompts'

export interface PreviewSession {
  session: RecordingSession
  timeline: Timeline
  videoUrl: string
  audioUrl: string | null
  systemAudioUrl: string | null
  systemAudioOffsetSec: number
}

export interface PreviewState {
  sessions: RecordingSession[]
  sessionsLoaded: boolean
  loading: boolean
  loadError: string | null
  current: PreviewSession | null
  motionParams: MotionParams
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
  customClips: CustomClip[]
  clipError: string | null

  loadSessions(): Promise<void>
  openSession(sessionId: string): Promise<void>
  closeSession(): void
  setMotionParams(patch: Partial<MotionParams>): void
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
  addCustomClip(offsetMs?: number): Promise<void>
  removeCustomClip(id: string): void
  setClipOffset(id: string, offsetMs: number): void
  setClipTrim(
    id: string,
    patch: Partial<Pick<CustomClip, 'offsetMs' | 'trimStartMs' | 'trimEndMs'>>
  ): void
  setClipGain(id: string, gain: number): void
}
