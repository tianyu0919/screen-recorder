import type { EditDocumentV1 } from '@shared/edit'
import { serializeEditDocument } from '@/timeline/editDocument'
import type { PreviewState } from './previewTypes'

type GetState = () => PreviewState
type SetState = (patch: Partial<PreviewState>) => void

let saveTimer: ReturnType<typeof setTimeout> | null = null
let fadeTimer: ReturnType<typeof setTimeout> | null = null
let saving = false

function snapshot(state: PreviewState): EditDocumentV1 {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    motionParams: state.motionParams,
    motionEffects: state.motionEffects,
    manualKeyPrompts: state.manualKeyPrompts,
    hiddenRecordedKeyIndices: state.hiddenRecordedKeyIndices,
    cuts: state.cuts,
    audioGain: state.audioGain,
    customAudio: state.customClips.flatMap((clip) =>
      clip.assetFile ? [{ ...clip, assetFile: clip.assetFile }] : []
    ),
    keyboardOverlay: state.keyboardOverlay
  }
}

async function persistLatest(get: GetState, set: SetState): Promise<void> {
  if (saving) return
  const state = get()
  const sessionId = state.current?.session.sessionId
  if (!sessionId || state.editRevision <= 0) return
  saving = true
  const revision = state.editRevision
  set({ saveState: { kind: 'saving', revision } })
  try {
    const result = await window.api.saveSessionEdit(
      sessionId,
      serializeEditDocument(snapshot(get()))
    )
    const latest = get()
    if (latest.current?.session.sessionId !== sessionId) return
    const current = {
      ...latest.current,
      session: { ...latest.current.session, editedAt: result.updatedAt }
    }
    const sessions = latest.sessions
      .map((session) =>
        session.sessionId === sessionId ? { ...session, editedAt: result.updatedAt } : session
      )
      .sort((a, b) => (b.editedAt ?? b.startedAt) - (a.editedAt ?? a.startedAt))
    if (latest.editRevision > revision) {
      set({ current, sessions })
      saving = false
      await persistLatest(get, set)
      return
    }
    set({ current, sessions, saveState: { kind: 'saved', revision } })
    if (fadeTimer) clearTimeout(fadeTimer)
    fadeTimer = setTimeout(() => {
      const currentSave = get().saveState
      if (currentSave.kind === 'saved' && currentSave.revision === revision) {
        set({ saveState: { kind: 'idle' } })
      }
    }, 1600)
  } catch (error) {
    set({
      saveState: {
        kind: 'error',
        revision,
        message: error instanceof Error ? error.message : String(error)
      }
    })
  } finally {
    saving = false
  }
}

export function markEditDirty(get: GetState, set: SetState, delayMs = 500): void {
  const revision = get().editRevision + 1
  set({ editRevision: revision, saveState: { kind: 'saving', revision } })
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    void persistLatest(get, set)
  }, Math.max(0, delayMs))
}

export function retryEditSave(get: GetState, set: SetState): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = null
  void persistLatest(get, set)
}

export function resetEditAutosave(): void {
  if (saveTimer) clearTimeout(saveTimer)
  if (fadeTimer) clearTimeout(fadeTimer)
  saveTimer = null
  fadeTimer = null
  saving = false
}
