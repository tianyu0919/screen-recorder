import type { ExportStartMessage } from '@/export/messages'
import { getClipAsset } from '@/export/clipCache'
import { usePreviewStore } from '@/store/previewStore'

export function createExportSnapshot(): ExportStartMessage | null {
  const state = usePreviewStore.getState()
  const current = state.current
  if (!current) return null
  return {
    type: 'start', sessionId: current.session.sessionId,
    sessionName: current.session.displayName ?? current.session.sessionId,
    keyframes: structuredClone(state.keyframes), ripples: structuredClone(state.ripples),
    keyPrompts: structuredClone(state.keyPrompts), keyboardOverlay: { ...state.keyboardOverlay },
    cuts: structuredClone(state.cuts),
    audioGain: {
      mic: state.audioMute.mic ? 0 : state.audioGain.mic,
      system: state.audioMute.system ? 0 : state.audioGain.system
    },
    renderSettings: structuredClone(state.renderSettings),
    captions: state.captions?.enabled ? structuredClone(state.captions) : null,
    customAudio: state.customClips.flatMap((clip) => {
      const asset = getClipAsset(clip.id)
      return asset ? [{
        offsetMs: clip.offsetMs, trimStartMs: clip.trimStartMs, trimEndMs: clip.trimEndMs,
        gain: clip.muted ? 0 : clip.gain, sampleRate: asset.wav.sampleRate,
        channels: asset.wav.channels, samples: asset.wav.samples.buffer.slice(0) as ArrayBuffer
      }] : []
    }),
    canvas: { ...current.timeline.canvas }, fallbackDurationMs: current.timeline.durationMs
  }
}
