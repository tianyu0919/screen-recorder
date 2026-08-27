import { toast } from 'sonner'
import { TTS_ENGINE_VERSION, type TtsGenerationResult, type TtsJobStatus } from '@shared/tts'
import { markEditDirty } from './editAutosave'
import { clearLastTtsRequest, getLastTtsRequest } from './previewTtsActions'
import type { PreviewState } from './previewTypes'

/**
 * TTS 生成状态桥（kr-08）：订阅 Main 的 onTtsStatusChanged 广播。
 * 只处理当前会话的事件；完成且带 result 时写入 ttsSettings、切换 mic 轨位到派生轨
 * 并 bump editRevision 触发自动保存。closeSession 时取消订阅。
 */

type GetState = () => PreviewState
type SetState = (patch: Partial<PreviewState>) => void

let dispose: (() => void) | null = null

export function ensureTtsBridge(get: GetState, set: SetState): void {
  if (dispose) return
  dispose = window.api.onTtsStatusChanged((status) => {
    const state = get()
    const current = state.current
    if (!current || status.sessionId !== current.session.sessionId) return
    set({ ttsJob: status })
    if (status.state === 'failed') {
      clearLastTtsRequest()
      toast.error(`配音生成失败：${status.error ?? '未知错误'}`)
      return
    }
    if (status.state !== 'completed') return
    // Main 在终态事件里附带 TtsGenerationResult（契约见 shared/tts.ts TtsJobResult）
    const result = (status as TtsJobStatus & { result?: TtsGenerationResult }).result
    if (!result) return
    const voiceId =
      getLastTtsRequest()?.sessionId === status.sessionId
        ? getLastTtsRequest()!.voiceId
        : state.ttsSettings?.voiceId
    clearLastTtsRequest()
    if (!voiceId) return
    set({
      ttsSettings: {
        enabled: true,
        voiceId,
        engineVersion: TTS_ENGINE_VERSION,
        derivedFile: result.derivedFile,
        derivedKey: result.derivedKey,
        overflowSegmentIds: result.overflowSegmentIds
      },
      current: {
        ...current,
        ttsDerivedUrl: `media://rec/${status.sessionId}/${result.derivedFile}`
      }
    })
    markEditDirty(get, set, 0)
    if (result.failedSegmentIds.length > 0) {
      toast.warning(`${result.failedSegmentIds.length} 个字幕段合成失败，已按静音处理`)
    }
    if (result.overflowSegmentIds.length > 0) {
      toast.warning(
        `${result.overflowSegmentIds.length} 个字幕段语速超出可调范围，配音可能溢出或被截断（字幕轨已标记 ⚠）`
      )
    }
  })
}

export function disposeTtsBridge(): void {
  dispose?.()
  dispose = null
  clearLastTtsRequest()
}

/** 打开会话时拉取音色列表并恢复进行中的生成任务进度（无任务/已终态则保持 ttsJob 为空）。 */
export function primeTtsOnOpen(get: GetState, set: SetState, sessionId: string): void {
  set({ ttsJob: null })
  void get().refreshTtsVoices()
  void window.api.getTtsStatus(sessionId).then((status) => {
    if (get().current?.session.sessionId !== sessionId) return
    if (status.state === 'running') set({ ttsJob: status })
  }).catch(() => undefined)
}
