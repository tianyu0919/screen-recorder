import { create } from 'zustand'
import { parseEventsJson, TimelineParseError } from '@/timeline/types'
import { DEFAULT_MOTION_PARAMS } from '@/timeline/keyframes'
import { normalizeCuts } from '@/timeline/cuts'
import { fetchSessionWav } from '@/export/audio'
import { estimateSystemOffsetSec } from '@/lib/audioAlign'
import { clearClipAssets } from '@/export/clipCache'
import { createDefaultEditDocument, EditDocumentError, parseEditDocument } from '@/timeline/editDocument'
import { derivePreviewEdit } from './previewDerive'
import { createPreviewAudioActions, clampPreviewClips } from './previewAudioActions'
import { createPreviewMotionActions } from './previewMotionActions'
import { markEditDirty, resetEditAutosave } from './editAutosave'
import { restoreCustomAudio } from './customAudioPersistence'
import type { PreviewSession, PreviewState } from './previewTypes'
import {
  DEFAULT_BACKGROUND_PADDING_PERCENT,
  normalizeBackgroundPaddingPercent
} from '@shared/edit'

export type { CustomClip } from '@/lib/audioClip'

const EMPTY_EDIT_STATE = {
  motionEffects: [],
  selectedMotionId: null,
  keyPrompts: [],
  manualKeyPrompts: [],
  hiddenRecordedKeyIndices: [],
  keyboardOverlay: { x: 0.5, y: 0.86 },
  saveState: { kind: 'idle' as const },
  editRevision: 0,
  editLoadError: null
}

export const usePreviewStore = create<PreviewState>((set, get) => ({
  sessions: [], sessionsLoaded: false, loading: false, loadError: null,
  current: null, motionParams: DEFAULT_MOTION_PARAMS, motionEnabled: true,
  keyframes: [], ripples: [],
  ...EMPTY_EDIT_STATE,
  cuts: [], sourceDurationMs: null, audioGain: { mic: 1, system: 1 },
  audioMute: { mic: false, system: false },
  renderSettings: {
    backgroundEnabled: false,
    backgroundColor: '#16181D',
    backgroundPaddingPercent: DEFAULT_BACKGROUND_PADDING_PERCENT
  },
  customClips: [], clipError: null,

  async loadSessions() {
    set({ loading: true, loadError: null })
    try { set({ sessions: await window.api.listSessions(), sessionsLoaded: true, loading: false }) }
    catch (error) { set({ loading: false, loadError: `无法加载会话：${error instanceof Error ? error.message : String(error)}` }) }
  },

  async trashSession(sessionId) {
    const previous = get().sessions
    set({ sessions: previous.filter((session) => session.sessionId !== sessionId) })
    await new Promise((resolve) => setTimeout(resolve, 0))
    try { await window.api.trashSession(sessionId) }
    catch (error) { set({ sessions: previous }); throw error }
    set({ sessions: await window.api.listSessions() })
  },
  async restoreSession(sessionId) {
    await window.api.restoreSession(sessionId)
    set({ sessions: await window.api.listSessions() })
  },
  async deleteSessionPermanent(sessionId) {
    const previous = get().sessions
    set({ sessions: previous.filter((session) => session.sessionId !== sessionId) })
    await new Promise((resolve) => setTimeout(resolve, 0))
    try { await window.api.deleteSessionPermanent(sessionId) }
    catch (error) { set({ sessions: previous }); throw error }
    set({ sessions: await window.api.listSessions() })
  },
  async emptyTrash() {
    await window.api.emptyTrash()
    set({ sessions: await window.api.listSessions() })
  },
  async removeMissingSession(sessionId) {
    await window.api.removeMissingSession(sessionId)
    set({ sessions: await window.api.listSessions() })
  },

  async openSession(sessionId) {
    resetEditAutosave()
    set({ loading: true, loadError: null })
    try {
      const result = await window.api.loadSession(sessionId)
      const timeline = parseEventsJson(result.eventsJson)
      let systemAudioOffsetSec = 0
      if (result.audioUrl && result.systemAudioUrl) {
        const [micWav, systemWav] = await Promise.all([
          fetchSessionWav(sessionId, 'mic.wav'),
          fetchSessionWav(sessionId, 'system.wav')
        ])
        if (micWav && systemWav) systemAudioOffsetSec = estimateSystemOffsetSec(micWav, systemWav)
      }
      const current: PreviewSession = {
        session: result.session, timeline, videoUrl: result.videoUrl,
        audioUrl: result.audioUrl, systemAudioUrl: result.systemAudioUrl, systemAudioOffsetSec
      }
      let editLoadError: string | null = null
      let document
      try {
        document = result.editJson
          ? parseEditDocument(result.editJson)
          : createDefaultEditDocument(
              timeline.events, timeline.canvas, get().motionParams, timeline.durationMs
            )
      } catch (error) {
        editLoadError = error instanceof EditDocumentError ? error.message : `编辑数据损坏：${String(error)}`
        document = createDefaultEditDocument(
          timeline.events, timeline.canvas, get().motionParams, timeline.durationMs
        )
      }
      clearClipAssets()
      const restored = await restoreCustomAudio(sessionId, document.customAudio)
      const derived = derivePreviewEdit(
        current, document.motionParams, document.motionEffects, document.manualKeyPrompts,
        document.hiddenRecordedKeyIndices, timeline.durationMs, document.motionEnabled
      )
      set({
        loading: false, current, motionParams: document.motionParams,
        motionEnabled: document.motionEnabled,
        motionEffects: document.motionEffects, selectedMotionId: null,
        manualKeyPrompts: document.manualKeyPrompts,
        hiddenRecordedKeyIndices: document.hiddenRecordedKeyIndices,
        keyboardOverlay: document.keyboardOverlay, cuts: document.cuts,
        audioGain: document.audioGain, audioMute: document.audioMute,
        renderSettings: document.renderSettings, customClips: restored.clips,
        clipError: restored.error, sourceDurationMs: null,
        saveState: { kind: 'idle' }, editRevision: 0, editLoadError, ...derived
      })
    } catch (error) {
      set({
        loading: false, current: null,
        loadError: error instanceof TimelineParseError
          ? error.message
          : `无法加载会话: ${error instanceof Error ? error.message : String(error)}`
      })
    }
  },

  closeSession() {
    resetEditAutosave()
    clearClipAssets()
    set({
      current: null, keyframes: [], ripples: [], loadError: null, cuts: [],
      sourceDurationMs: null, audioGain: { mic: 1, system: 1 },
      audioMute: { mic: false, system: false },
      renderSettings: {
        backgroundEnabled: false,
        backgroundColor: '#16181D',
        backgroundPaddingPercent: DEFAULT_BACKGROUND_PADDING_PERCENT
      },
      motionEnabled: true, customClips: [],
      clipError: null, ...EMPTY_EDIT_STATE
    })
  },

  setMotionParams(patch) {
    const state = get()
    const motionParams = { ...state.motionParams, ...patch }
    const motionEffects = patch.targetZoom === undefined
      ? state.motionEffects
      : state.motionEffects.map((effect) => ({ ...effect, zoom: patch.targetZoom! }))
    set({ motionParams, motionEffects })
    if (!state.current) return
    set(derivePreviewEdit(
      state.current, motionParams, motionEffects, state.manualKeyPrompts,
      state.hiddenRecordedKeyIndices, state.sourceDurationMs ?? Infinity,
      state.motionEnabled
    ))
    markEditDirty(get, set)
  },

  setMotionEnabled(motionEnabled) {
    const state = get()
    if (state.motionEnabled === motionEnabled) return
    set({
      motionEnabled,
      ...(state.current ? derivePreviewEdit(
        state.current, state.motionParams, state.motionEffects, state.manualKeyPrompts,
        state.hiddenRecordedKeyIndices, state.sourceDurationMs ?? Infinity, motionEnabled
      ) : {})
    })
    markEditDirty(get, set, 0)
  },

  setRenderSettings(patch) {
    const next = { ...get().renderSettings, ...patch }
    if (patch.backgroundColor && !/^#[0-9a-f]{6}$/i.test(patch.backgroundColor)) return
    if (patch.backgroundColor) next.backgroundColor = patch.backgroundColor.toUpperCase()
    if (patch.backgroundPaddingPercent !== undefined) {
      next.backgroundPaddingPercent = normalizeBackgroundPaddingPercent(
        patch.backgroundPaddingPercent
      )
    }
    set({ renderSettings: next })
    markEditDirty(get, set, 0)
  },

  addCut(range) {
    set({ cuts: normalizeCuts([...get().cuts, range]) })
    markEditDirty(get, set, 0)
  },
  removeCut(index) {
    set({ cuts: get().cuts.filter((_, itemIndex) => itemIndex !== index) })
    markEditDirty(get, set, 0)
  },
  clearCuts() {
    set({ cuts: [] })
    markEditDirty(get, set, 0)
  },

  setSourceDurationMs(durationMs) {
    if (!Number.isFinite(durationMs) || durationMs <= 0) return
    const state = get()
    if (state.sourceDurationMs !== null && Math.abs(state.sourceDurationMs - durationMs) < 1) return
    const motionEffects = state.motionEffects.flatMap((effect) =>
      effect.startMs < durationMs ? [{ ...effect, endMs: Math.min(effect.endMs, durationMs) }] : []
    )
    set({
      sourceDurationMs: durationMs, motionEffects,
      customClips: clampPreviewClips(state, durationMs),
      ...(state.current ? derivePreviewEdit(
        state.current, state.motionParams, motionEffects, state.manualKeyPrompts,
        state.hiddenRecordedKeyIndices, durationMs, state.motionEnabled
      ) : {})
    })
  },

  ...createPreviewMotionActions(set, get),
  ...createPreviewAudioActions(set, get)
}))
