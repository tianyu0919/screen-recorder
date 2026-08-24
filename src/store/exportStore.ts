import { create } from 'zustand'
import type { ExportFormat } from '@shared/types'
import type { ExportWorkerMessage } from '@/export/messages'
import { usePreviewStore } from './previewStore'
import { getClipAsset } from '@/export/clipCache'

/**
 * 导出状态（kr-03 Task 3.1 / 3.2）：
 * startExport 取预览当前的 keyframes/ripples（参数面板调好后的效果）启动 Worker；
 * 取消 = worker.terminate() 硬终止（输出在内存，无半成品文件）；
 * 完成后经 saveExport IPC 弹保存对话框落盘。
 */

type ExportStatus = 'idle' | 'exporting' | 'done' | 'error'

interface ExportState {
  status: ExportStatus
  /** 0..1，按已渲染帧数成比例 */
  progress: number
  /** 完成后的保存路径（用户在保存对话框取消则为 null） */
  resultPath: string | null
  outputFormat: ExportFormat | null
  hasAudio: boolean
  outputSize: { width: number; height: number } | null
  errorMessage: string | null

  startExport(): Promise<void>
  cancelExport(): void
  reset(): void
}

/** 当前导出 Worker 句柄（不进 state，避免不必要的订阅触发） */
let activeWorker: Worker | null = null
/** 使已终止导出的异步回调失效，避免保存完成后把旧结果写回新会话。 */
let exportGeneration = 0

function terminateWorker(): void {
  activeWorker?.terminate()
  activeWorker = null
}

export const useExportStore = create<ExportState>((set, get) => ({
  status: 'idle',
  progress: 0,
  resultPath: null,
  outputFormat: null,
  hasAudio: false,
  outputSize: null,
  errorMessage: null,

  async startExport() {
    if (get().status === 'exporting') return
    const {
      current, keyframes, ripples, keyPrompts, keyboardOverlay,
      cuts, audioGain, audioMute, customClips, renderSettings
    } =
      usePreviewStore.getState()
    if (!current) return
    const sessionId = current.session.sessionId

    terminateWorker()
    const generation = ++exportGeneration
    const worker = new Worker(new URL('../export/worker.ts', import.meta.url), {
      type: 'module'
    })
    activeWorker = worker
    set({
      status: 'exporting',
      progress: 0,
      resultPath: null,
      outputFormat: null,
      hasAudio: false,
      outputSize: null,
      errorMessage: null
    })

    worker.onmessage = (event: MessageEvent<ExportWorkerMessage>) => {
      if (generation !== exportGeneration) return
      const msg = event.data
      if (msg.type === 'progress') {
        set({
          progress: msg.total > 0 ? msg.done / msg.total : 0,
          ...(msg.outputWidth && msg.outputHeight
            ? { outputSize: { width: msg.outputWidth, height: msg.outputHeight } }
            : {})
        })
      } else if (msg.type === 'error') {
        terminateWorker()
        set({ status: 'error', errorMessage: msg.message })
      } else {
        // done：Worker 侧 buffer 已 transfer 过来，弹保存对话框落盘
        terminateWorker()
        void window.api
          .saveExport(sessionId, msg.buffer, msg.format)
          .then((saved) => {
            if (generation !== exportGeneration) return
            set({
              status: 'done',
              progress: 1,
              outputFormat: msg.format,
              hasAudio: msg.audio,
              outputSize: { width: msg.outputWidth, height: msg.outputHeight },
              resultPath: saved?.path ?? null
            })
          })
          .catch((err: unknown) => {
            if (generation !== exportGeneration) return
            set({
              status: 'error',
              errorMessage: `保存失败: ${err instanceof Error ? err.message : String(err)}`
            })
          })
      }
    }
    worker.onerror = () => {
      if (generation !== exportGeneration) return
      terminateWorker()
      set({ status: 'error', errorMessage: '导出失败: 导出线程异常终止' })
    }

    worker.postMessage({
      type: 'start',
      sessionId,
      keyframes,
      ripples,
      keyPrompts,
      keyboardOverlay,
      cuts,
      audioGain: {
        mic: audioMute.mic ? 0 : audioGain.mic,
        system: audioMute.system ? 0 : audioGain.system
      },
      renderSettings,
      // 自定义音轨 PCM：缓存缺失的轨跳过（不阻断导出）；samples 结构化克隆（缓存保留复导出）
      customAudio: customClips.flatMap((c) => {
        const asset = getClipAsset(c.id)
        return asset
          ? [
              {
                offsetMs: c.offsetMs,
                trimStartMs: c.trimStartMs,
                trimEndMs: c.trimEndMs,
                gain: c.muted ? 0 : c.gain,
                sampleRate: asset.wav.sampleRate,
                channels: asset.wav.channels,
                samples: asset.wav.samples.buffer as ArrayBuffer
              }
            ]
          : []
      }),
      canvas: current.timeline.canvas,
      fallbackDurationMs: current.timeline.durationMs
    })
  },

  cancelExport() {
    if (get().status !== 'exporting') return
    exportGeneration += 1
    terminateWorker()
    set({ status: 'idle', progress: 0 })
  },

  reset() {
    exportGeneration += 1
    terminateWorker()
    set({
      status: 'idle',
      progress: 0,
      resultPath: null,
      outputFormat: null,
      hasAudio: false,
      outputSize: null,
      errorMessage: null
    })
  }
}))
