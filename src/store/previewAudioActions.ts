import type { PreviewState } from './previewTypes'
import { clampAudioClipToTimeline, updateAudioClipRange } from '@/lib/audioClip'
import { importCustomAudio } from './customAudioImport'
import { markEditDirty } from './editAutosave'
import { removeClipAsset, setClipAsset } from '@/export/clipCache'

type GetState = () => PreviewState
type SetState = (patch: Partial<PreviewState>) => void
type AudioActions = Pick<
  PreviewState,
  | 'setAudioGain'
  | 'setAudioMuted'
  | 'addCustomClip'
  | 'removeCustomClip'
  | 'setClipOffset'
  | 'setClipTrim'
  | 'setClipGain'
  | 'setClipMuted'
>

export function createPreviewAudioActions(set: SetState, get: GetState): AudioActions {
  return {
    setAudioGain(patch) {
      set({ audioGain: { ...get().audioGain, ...patch } })
      markEditDirty(get, set)
    },

    setAudioMuted(track, muted) {
      set({ audioMute: { ...get().audioMute, [track]: muted } })
      markEditDirty(get, set, 0)
    },

    async addCustomClip(offsetMs = 0) {
      const current = get().current
      if (!current) return
      const sessionId = current.session.sessionId
      set({ clipError: null })
      const result = await importCustomAudio(get().sourceDurationMs ?? Infinity, offsetMs)
      if (result.kind === 'cancel') return
      if (result.kind === 'error') {
        set({ clipError: result.message })
        return
      }
      if (get().current?.session.sessionId !== sessionId) return
      try {
        const assetFile = await window.api.saveSessionAudioAsset(
          sessionId,
          result.clip.id,
          result.clip.name,
          result.sourceData
        )
        const clip = { ...result.clip, assetFile }
        setClipAsset(clip.id, { wav: result.wav, audioBuffer: result.audioBuffer })
        set({ customClips: [...get().customClips, clip], clipError: null })
        markEditDirty(get, set, 0)
      } catch (error) {
        set({
          clipError: `无法保存音频资产：${error instanceof Error ? error.message : String(error)}`
        })
      }
    },

    removeCustomClip(id) {
      const clip = get().customClips.find((item) => item.id === id)
      removeClipAsset(id)
      set({ customClips: get().customClips.filter((item) => item.id !== id) })
      if (clip?.assetFile && get().current) {
        void window.api.deleteSessionAudioAsset(get().current!.session.sessionId, clip.assetFile)
      }
      markEditDirty(get, set, 0)
    },

    setClipOffset(id, offsetMs) {
      get().setClipTrim(id, { offsetMs })
    },

    setClipTrim(id, patch) {
      const timelineDuration = get().sourceDurationMs ?? Infinity
      set({
        customClips: get().customClips.map((clip) =>
          clip.id === id ? updateAudioClipRange(clip, patch, timelineDuration) : clip
        )
      })
    },

    setClipGain(id, gain) {
      set({
        customClips: get().customClips.map((clip) =>
          clip.id === id ? { ...clip, gain } : clip
        )
      })
      markEditDirty(get, set)
    },

    setClipMuted(id, muted) {
      set({
        customClips: get().customClips.map((clip) =>
          clip.id === id ? { ...clip, muted } : clip
        )
      })
      markEditDirty(get, set, 0)
    }
  }
}

export function clampPreviewClips(state: PreviewState, durationMs: number) {
  return state.customClips.map((clip) => clampAudioClipToTimeline(clip, durationMs))
}
