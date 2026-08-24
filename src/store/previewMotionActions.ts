import type { PreviewState } from './previewTypes'
import {
  createManualMotionEffect,
  moveMotionEffect as moveEffect,
  resizeMotionEffect as resizeEffect
} from '@/timeline/motionEffects'
import { derivePreviewEdit } from './previewDerive'
import { isAllowedKeyPrompt, normalizeKeyName } from '@/timeline/keyPrompts'
import { markEditDirty, retryEditSave } from './editAutosave'

type GetState = () => PreviewState
type SetState = (patch: Partial<PreviewState>) => void
type MotionActions = Pick<
  PreviewState,
  | 'setSegmentZoom'
  | 'resetSegmentZoom'
  | 'selectMotionEffect'
  | 'addMotionEffect'
  | 'moveMotionEffect'
  | 'resizeMotionEffect'
  | 'removeMotionEffect'
  | 'addManualKeyPrompt'
  | 'removeKeyPrompt'
  | 'setKeyboardOverlay'
  | 'commitEdit'
  | 'retrySave'
>

function anchors(state: PreviewState, playhead?: number): number[] {
  const events = state.current?.timeline.events
  return [
    ...(events?.clicks.map((event) => event.t) ?? []),
    ...(events?.keys.map((event) => event.t) ?? []),
    ...(playhead === undefined ? [] : [playhead])
  ]
}

function applyMotionEffects(
  set: SetState,
  get: GetState,
  motionEffects: PreviewState['motionEffects']
): void {
  const state = get()
  if (!state.current) return
  set({
    motionEffects,
    ...derivePreviewEdit(
      state.current,
      state.motionParams,
      motionEffects,
      state.manualKeyPrompts,
      state.hiddenRecordedKeyIndices,
      state.sourceDurationMs ?? Infinity,
      state.motionEnabled
    )
  })
}

export function createPreviewMotionActions(set: SetState, get: GetState): MotionActions {
  return {
    setSegmentZoom(id, zoom) {
      if (!get().motionEnabled) return
      applyMotionEffects(
        set,
        get,
        get().motionEffects.map((effect) =>
          effect.id === id ? { ...effect, zoom: Math.min(4, Math.max(1, zoom)) } : effect
        )
      )
      markEditDirty(get, set)
    },

    resetSegmentZoom(id) {
      get().setSegmentZoom(id, get().motionParams.targetZoom)
    },

    selectMotionEffect(id) {
      set({ selectedMotionId: id })
    },

    addMotionEffect(tMs) {
      const state = get()
      if (!state.current || !state.motionEnabled) return null
      const effect = createManualMotionEffect(
        tMs,
        state.sourceDurationMs ?? state.current.timeline.durationMs,
        state.motionParams,
        state.motionEffects,
        anchors(state)
      )
      if (!effect) return null
      applyMotionEffects(set, get, [...state.motionEffects, effect])
      set({ selectedMotionId: effect.id })
      markEditDirty(get, set, 0)
      return effect.id
    },

    moveMotionEffect(id, startMs, commit = false, playhead) {
      if (!get().motionEnabled) return
      const state = get()
      const effects = moveEffect(
        state.motionEffects,
        id,
        startMs,
        state.sourceDurationMs ?? state.current?.timeline.durationMs ?? 0,
        anchors(state, playhead)
      )
      applyMotionEffects(set, get, effects)
      if (commit) markEditDirty(get, set, 0)
    },

    resizeMotionEffect(id, edge, tMs, commit = false, playhead) {
      if (!get().motionEnabled) return
      const state = get()
      const effects = resizeEffect(
        state.motionEffects,
        id,
        edge,
        tMs,
        state.sourceDurationMs ?? state.current?.timeline.durationMs ?? 0,
        anchors(state, playhead)
      )
      applyMotionEffects(set, get, effects)
      if (commit) markEditDirty(get, set, 0)
    },

    removeMotionEffect(id) {
      if (!get().motionEnabled) return
      applyMotionEffects(set, get, get().motionEffects.filter((effect) => effect.id !== id))
      set({ selectedMotionId: null })
      markEditDirty(get, set, 0)
    },

    addManualKeyPrompt(tMs, keys) {
      const normalized = keys.map(normalizeKeyName).filter(Boolean)
      if (!isAllowedKeyPrompt(normalized)) return
      const manualKeyPrompts = [
        ...get().manualKeyPrompts,
        { id: crypto.randomUUID(), t: Math.max(0, tMs), keys: normalized }
      ]
      const state = get()
      set({
        manualKeyPrompts,
        keyPrompts: state.current
          ? derivePreviewEdit(
              state.current,
              state.motionParams,
              state.motionEffects,
              manualKeyPrompts,
              state.hiddenRecordedKeyIndices,
              state.sourceDurationMs ?? Infinity,
              state.motionEnabled
            ).keyPrompts
          : []
      })
      markEditDirty(get, set, 0)
    },

    removeKeyPrompt(id) {
      const state = get()
      const prompt = state.keyPrompts.find((item) => item.id === id)
      const manualKeyPrompts = state.manualKeyPrompts.filter((item) => item.id !== id)
      const hiddenRecordedKeyIndices = prompt?.source === 'recorded'
        ? [...new Set([...state.hiddenRecordedKeyIndices, ...prompt.sourceIndices])]
        : state.hiddenRecordedKeyIndices
      set({ manualKeyPrompts, hiddenRecordedKeyIndices })
      if (state.current) {
        set({
          keyPrompts: derivePreviewEdit(
            state.current,
            state.motionParams,
            state.motionEffects,
            manualKeyPrompts,
            hiddenRecordedKeyIndices,
            state.sourceDurationMs ?? Infinity,
            state.motionEnabled
          ).keyPrompts
        })
      }
      markEditDirty(get, set, 0)
    },

    setKeyboardOverlay(position, commit = false) {
      set({
        keyboardOverlay: {
          x: Math.min(0.95, Math.max(0.05, position.x)),
          y: Math.min(0.95, Math.max(0.05, position.y))
        }
      })
      if (commit) markEditDirty(get, set, 0)
    },

    commitEdit() {
      markEditDirty(get, set, 0)
    },

    retrySave() {
      retryEditSave(get, set)
    }
  }
}
