import { toast } from 'sonner'
import { buildTtsSegmentRequests, expectedTtsDurationMs } from '@/tts/segments'
import { markEditDirty } from './editAutosave'
import type { PreviewState } from './previewTypes'

/**
 * TTS 配音 actions（kr-08-tts-dubbing，仿 previewCaptionActions 模式）。
 * 生成结果经 onTtsStatusChanged 广播回来（ttsBridge 写入 ttsSettings 并触发自动保存），
 * 这里只负责发起/取消与音色管理。
 */

type GetState = () => PreviewState
type SetState = (patch: Partial<PreviewState>) => void

/** 最近一次生成请求（ttsBridge 完成回调需要 voiceId 写入 ttsSettings）。 */
let lastTtsRequest: { sessionId: string; voiceId: string } | null = null
export function getLastTtsRequest(): { sessionId: string; voiceId: string } | null {
  return lastTtsRequest
}
export function setLastTtsRequest(sessionId: string, voiceId: string): void {
  lastTtsRequest = { sessionId, voiceId }
}
export function clearLastTtsRequest(): void {
  lastTtsRequest = null
}

/** 试听播放单例：新试听开始前停掉上一个，ended 后回收 Blob URL。 */
let previewAudio: HTMLAudioElement | null = null

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function createPreviewTtsActions(set: SetState, get: GetState) {
  return {
    async refreshTtsVoices() {
      try {
        set({ ttsVoices: await window.api.listTtsVoices() })
      } catch (error) {
        toast.error(`音色列表加载失败：${errorMessage(error)}`)
      }
    },

    async startTtsGeneration(voiceId: string) {
      const state = get()
      const current = state.current
      if (!current) return
      const sessionId = current.session.sessionId
      const captions = state.captions
      const segments = captions ? await buildTtsSegmentRequests(captions, voiceId) : []
      if (!segments.length) {
        toast.warning('请先添加字幕，再生成配音')
        return
      }
      try {
        // 有 mic.wav 以麦克风时长为等长基准（sourceDurationMs 可能尚未就绪则回退时间轴时长）
        const expectedDurationMs = expectedTtsDurationMs(
          current.audioUrl !== null,
          state.sourceDurationMs ?? current.timeline.durationMs,
          current.timeline.durationMs
        )
        setLastTtsRequest(sessionId, voiceId)
        const status = await window.api.startTtsGeneration({
          sessionId, voiceId, segments, expectedDurationMs
        })
        if (get().current?.session.sessionId === sessionId) set({ ttsJob: status })
      } catch (error) {
        clearLastTtsRequest()
        toast.error(`配音生成失败：${errorMessage(error)}`)
      }
    },

    async cancelTtsGeneration() {
      const sessionId = get().current?.session.sessionId
      if (!sessionId) return
      try {
        const status = await window.api.cancelTtsGeneration(sessionId)
        if (get().current?.session.sessionId === sessionId) set({ ttsJob: status })
      } catch (error) {
        toast.error(`取消配音失败：${errorMessage(error)}`)
      }
    },

    setTtsEnabled(enabled: boolean) {
      const state = get()
      if (!state.current) return
      if (!enabled) {
        // 关闭 = 清空设置（派生文件保留在会话目录，重新生成时缓存命中）
        if (!state.ttsSettings) return
        set({ ttsSettings: null })
        markEditDirty(get, set, 0)
        return
      }
      if (!state.ttsSettings || state.ttsSettings.enabled) return
      set({ ttsSettings: { ...state.ttsSettings, enabled: true } })
      markEditDirty(get, set, 0)
    },

    async previewTtsVoice(voiceId: string, language: 'zh' | 'en') {
      try {
        const bytes = await window.api.previewTtsVoice(voiceId, language)
        previewAudio?.pause()
        const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }))
        const audio = new Audio(url)
        previewAudio = audio
        audio.addEventListener('ended', () => {
          URL.revokeObjectURL(url)
          if (previewAudio === audio) previewAudio = null
        })
        await audio.play()
      } catch (error) {
        toast.error(`试听失败：${errorMessage(error)}`)
      }
    },

    async importTtsModel() {
      try {
        const voices = await window.api.importTtsModel()
        if (voices) set({ ttsVoices: voices })
      } catch (error) {
        toast.error(`模型导入失败：${errorMessage(error)}`)
      }
    },

    async deleteTtsModel(modelKey: string) {
      try {
        set({ ttsVoices: await window.api.deleteTtsModel(modelKey) })
      } catch (error) {
        toast.error(`模型删除失败：${errorMessage(error)}`)
      }
    }
  }
}
