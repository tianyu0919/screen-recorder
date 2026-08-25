import type { CaptionsDocument } from '@shared/captions'
import type { PreviewState } from './previewTypes'

type GetState = () => PreviewState
type SetState = (patch: Partial<PreviewState>) => void
let timer: ReturnType<typeof setTimeout> | null = null
let savedTimer: ReturnType<typeof setTimeout> | null = null
let pendingSave: (() => Promise<void>) | null = null
let revision = 0

export function persistCaptionsSoon(get: GetState, set: SetState, delayMs = 400): void {
  if (timer) clearTimeout(timer)
  if (savedTimer) { clearTimeout(savedTimer); savedTimer = null }
  set({ captionsSaveState: 'pending', captionsError: null })
  const saveRevision = ++revision
  pendingSave = async () => {
    timer = null
    pendingSave = null
    const state = get()
    const sessionId = state.current?.session.sessionId
    const document = state.captions
    if (!sessionId || !document) return
    set({ captionsSaveState: 'saving', captionsError: null })
    try {
      const next: CaptionsDocument = { ...document, updatedAt: new Date().toISOString() }
      await window.api.saveSessionCaptions(sessionId, next)
      if (revision === saveRevision && get().current?.session.sessionId === sessionId) {
        set({ captions: get().captions === document ? next : get().captions, captionsSaveState: 'saved' })
        savedTimer = setTimeout(() => {
          if (revision === saveRevision) set({ captionsSaveState: 'idle' })
          savedTimer = null
        }, 1_500)
      }
    } catch (error) {
      if (revision === saveRevision && get().current?.session.sessionId === sessionId) {
        set({ captionsSaveState: 'error', captionsError: `字幕保存失败：${error instanceof Error ? error.message : String(error)}` })
      }
    }
  }
  timer = setTimeout(() => { void pendingSave?.() }, Math.max(0, delayMs))
}

export function retryCaptionPersistence(get: GetState, set: SetState): void {
  persistCaptionsSoon(get, set, 0)
}

export function resetCaptionPersistence(): void {
  if (timer) clearTimeout(timer)
  if (savedTimer) clearTimeout(savedTimer)
  timer = null
  savedTimer = null
  const save = pendingSave
  pendingSave = null
  if (save) void save()
}
