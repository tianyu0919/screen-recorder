import type { PreviewState } from './previewTypes'
import { parseCaptionsDocument } from '@/captions/document'

type GetState = () => PreviewState
type SetState = (patch: Partial<PreviewState>) => void
let dispose: (() => void) | null = null

export function ensureTranscriptionBridge(get: GetState, set: SetState): void {
  if (dispose) return
  dispose = window.api.onTranscriptionStatusChanged((snapshot) => {
    const sessionId = get().current?.session.sessionId
    if (snapshot.sessionId !== sessionId) return
    set({ transcription: snapshot.status })
    if (snapshot.status.state !== 'done') return
    void Promise.all([
      window.api.loadSession(snapshot.sessionId),
      window.api.listCaptionModels()
    ]).then(([result, captionModels]) => {
      const current = get().current
      if (!current || current.session.sessionId !== snapshot.sessionId || !result.captionsJson) return
      try {
        const captions = parseCaptionsDocument(result.captionsJson, current.timeline.durationMs)
        set({
          captions,
          captionsEnabled: captions.enabled,
          captionsError: null,
          selectedCaptionId: null,
          captionModels
        })
      } catch (error) {
        set({ captionsError: error instanceof Error ? error.message : String(error) })
      }
    }).catch((error: unknown) => {
      if (get().current?.session.sessionId === snapshot.sessionId) {
        set({ captionsError: `字幕结果加载失败：${error instanceof Error ? error.message : String(error)}` })
      }
    })
  })
}
