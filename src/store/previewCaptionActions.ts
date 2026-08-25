import {
  DEFAULT_CAPTION_STYLE,
  type CaptionLanguage,
  type CaptionPosition,
  type CaptionStyle,
  type CaptionsDocument
} from '@shared/captions'
import { BUILTIN_CAPTION_MODEL_ID } from '@shared/captionModels'
import { parseWhisperSrt } from '@shared/transcription'
import { mergeCaptionSegments, normalizeCaptionSegments, splitCaptionSegment } from '@/captions/operations'
import { serializeSrt } from '@/captions/srt'
import { persistCaptionsSoon, retryCaptionPersistence } from './captionPersistence'
import type { PreviewState } from './previewTypes'

type GetState = () => PreviewState
type SetState = (patch: Partial<PreviewState>) => void

export function createPreviewCaptionActions(set: SetState, get: GetState) {
  const updateDocument = (patch: Partial<NonNullable<PreviewState['captions']>>, delay = 400): void => {
    const captions = get().captions
    if (!captions) return
    set({ captions: { ...captions, ...patch } })
    persistCaptionsSoon(get, set, delay)
  }
  return {
    async startTranscription(language: 'auto' | 'zh' | 'en', modelId: string, replaceExisting: boolean) {
      const sessionId = get().current?.session.sessionId
      if (!sessionId) return
      try {
        const snapshot = await window.api.startTranscription({ sessionId, language, modelId, replaceExisting })
        if (get().current?.session.sessionId === sessionId) set({ transcription: snapshot.status, captionsError: null })
      } catch (error) {
        set({ captionsError: error instanceof Error ? error.message : String(error) })
      }
    },
    async cancelTranscription() {
      const sessionId = get().current?.session.sessionId
      if (!sessionId) return
      const snapshot = await window.api.cancelTranscription(sessionId)
      if (get().current?.session.sessionId === sessionId) set({ transcription: snapshot.status })
    },
    async refreshCaptionModels() {
      set({ captionModels: await window.api.listCaptionModels() })
    },
    async importCaptionModel() {
      try {
        const imported = await window.api.importCaptionModel()
        set({ captionModels: await window.api.listCaptionModels() })
        return imported
      } catch (error) {
        set({ captionsError: error instanceof Error ? error.message : String(error) })
        return null
      }
    },
    async deleteCaptionModel(modelId: string) {
      try {
        set({ captionModels: await window.api.deleteCaptionModel(modelId), captionsError: null })
      } catch (error) {
        set({ captionsError: error instanceof Error ? error.message : String(error) })
      }
    },
    selectCaption(id: string | null) { set({ selectedCaptionId: id }) },
    setCaptionPositionMode(mode: 'global' | 'segment') { set({ captionPositionMode: mode }) },
    updateCaptionText(id: string, text: string) {
      const captions = get().captions
      if (!captions) return
      updateDocument({ segments: captions.segments.map((segment) => segment.id === id ? { ...segment, text } : segment) })
    },
    updateCaptionRange(id: string, startMs: number, endMs: number, commit = true) {
      const state = get(), captions = state.captions
      if (!captions) return
      const duration = state.sourceDurationMs ?? state.current?.timeline.durationMs ?? Infinity
      const segments = normalizeCaptionSegments(
        captions.segments.map((segment) => segment.id === id ? { ...segment, startMs, endMs } : segment),
        duration
      )
      updateDocument({ segments }, commit ? 0 : 400)
    },
    splitCaption(id: string, atMs: number) {
      const captions = get().captions
      if (!captions) return
      updateDocument({ segments: captions.segments.flatMap((segment) => segment.id === id ? splitCaptionSegment(segment, atMs) : [segment]) }, 0)
    },
    mergeCaptionWithNext(id: string) {
      const captions = get().captions
      if (!captions) return
      const index = captions.segments.findIndex((segment) => segment.id === id)
      if (index < 0 || index >= captions.segments.length - 1) return
      const segments = [...captions.segments]
      segments.splice(index, 2, mergeCaptionSegments(segments[index], segments[index + 1]))
      updateDocument({ segments }, 0)
    },
    removeCaption(id: string) {
      const captions = get().captions
      if (!captions) return
      updateDocument({ segments: captions.segments.filter((segment) => segment.id !== id) }, 0)
      if (get().selectedCaptionId === id) set({ selectedCaptionId: null })
    },
    addCaptionAt(tMs: number) {
      const state = get(), captions = state.captions
      if (!captions || !state.captionsEnabled) return
      const duration = state.sourceDurationMs ?? state.current?.timeline.durationMs ?? 0
      const startMs = Math.max(0, Math.min(Math.round(tMs), Math.max(0, duration - 100)))
      const next = captions.segments.find((segment) => segment.startMs > startMs)
      const endMs = Math.min(duration, startMs + 2_000, next?.startMs ?? Infinity)
      if (endMs <= startMs) return
      const id = `caption-manual-${Date.now()}`
      updateDocument({ segments: normalizeCaptionSegments([
        ...captions.segments, { id, startMs, endMs, text: '新字幕' }
      ], duration) }, 0)
      set({ selectedCaptionId: id })
    },
    setCaptionStyle(patch: Partial<CaptionStyle>) {
      const captions = get().captions
      if (captions) updateDocument({ style: { ...captions.style, ...patch } })
    },
    setCaptionPosition(position: CaptionPosition, segmentOnly: boolean, commit = true) {
      const state = get(), captions = state.captions
      if (!captions) return
      const clamped = { x: Math.min(0.95, Math.max(0.05, position.x)), y: Math.min(0.95, Math.max(0.05, position.y)) }
      if (segmentOnly && state.selectedCaptionId) {
        updateDocument({ segments: captions.segments.map((segment) => segment.id === state.selectedCaptionId ? { ...segment, positionOverride: clamped } : segment) }, commit ? 0 : 400)
      } else updateDocument({ style: { ...captions.style, position: clamped } }, commit ? 0 : 400)
    },
    setCaptionsEnabled(enabled: boolean, language: CaptionLanguage = 'zh', modelId: string = BUILTIN_CAPTION_MODEL_ID) {
      const state = get()
      if (state.captionsEnabled === enabled) return
      set({ captionsEnabled: enabled })
      if (!enabled) {
        void state.cancelTranscription()
        if (state.captions) updateDocument({ enabled: false }, 0)
        return
      }
      if (state.captions?.segments.length) {
        updateDocument({ enabled: true }, 0)
        return
      }
      const sessionId = state.current?.session.sessionId
      if (!sessionId) return
      const document: CaptionsDocument = state.captions ?? {
        version: 1, source: 'mic', language,
        style: { ...DEFAULT_CAPTION_STYLE, position: { ...DEFAULT_CAPTION_STYLE.position } },
        enabled: true, segments: [], updatedAt: new Date().toISOString()
      }
      set({ captions: { ...document, enabled: true }, captionsSaveState: 'saving' })
      void window.api.saveSessionCaptions(sessionId, { ...document, enabled: true }).then(() => {
        if (get().current?.session.sessionId !== sessionId) return
        if (!get().captionsEnabled) {
          const current = get().captions
          if (current) void window.api.saveSessionCaptions(sessionId, { ...current, enabled: false })
          return
        }
        set({ captionsSaveState: 'saved' })
        if (state.current?.audioUrl) void get().startTranscription(language, modelId, true)
      }).catch((error: unknown) => {
        set({ captionsSaveState: 'error', captionsError: `字幕保存失败：${error instanceof Error ? error.message : String(error)}` })
      })
    },
    retryCaptionSave() { retryCaptionPersistence(get, set) },
    importCaptionsSrt(source: string) {
      const state = get(), captions = state.captions
      if (!state.captionsEnabled || !captions) return
      const duration = state.sourceDurationMs ?? state.current?.timeline.durationMs ?? Infinity
      const segments = normalizeCaptionSegments(parseWhisperSrt(source), duration)
      if (!segments.length) {
        set({ captionsError: 'SRT 中没有可导入的合法字幕' })
        return
      }
      updateDocument({ source: 'srt', segments }, 0)
      set({ selectedCaptionId: null })
    },
    async exportCaptionsSrt() {
      const state = get(), sessionId = state.current?.session.sessionId
      if (!state.captionsEnabled || !state.captions || !sessionId) return
      const duration = state.sourceDurationMs ?? state.current!.timeline.durationMs
      await window.api.exportSessionSrt(sessionId, serializeSrt(state.captions.segments, state.cuts, duration))
    }
  }
}
