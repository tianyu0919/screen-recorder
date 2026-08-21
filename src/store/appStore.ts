import { create } from 'zustand'
import type {
  CaptureSource,
  PermissionStatus,
  RecordingError,
  StartRecordingResult
} from '@shared/types'
import { ScreenRecorder } from '@/recorder/screenRecorder'

type RecordStatus = 'idle' | 'recording' | 'stopping'

/** 顶层视图：录制 / 预览（kr-02 Phase 3） */
export type AppView = 'record' | 'preview'

interface AppState {
  view: AppView
  sources: CaptureSource[]
  sourcesLoaded: boolean
  selectedSourceId: string | null
  /** 选中源后的预览流（srcObject 用） */
  previewStream: MediaStream | null
  permissions: PermissionStatus | null
  status: RecordStatus
  /** 本次录制开始时刻（Date.now ms）；录制计时由它推导，切换视图/组件重挂载不归零 */
  recordingStartedAt: number | null
  withMic: boolean
  error: RecordingError | null
  /** 输入钩子降级提示 */
  inputHookDegraded: boolean
  lastSession: { dir: string; sessionId: string } | null

  loadSources(): Promise<void>
  refreshPermissions(): Promise<void>
  selectSource(id: string): Promise<void>
  setWithMic(v: boolean): void
  setView(v: AppView): void
  clearError(): void
  startRecording(): Promise<void>
  stopRecording(): Promise<void>
}

const recorder = new ScreenRecorder({
  onFatalError: (err) => {
    useAppStore.getState().handleFatal(err)
  }
})

interface AppStateActions {
  handleFatal(err: RecordingError): void
}

export const useAppStore = create<AppState & AppStateActions>((set, get) => ({
  view: 'record',
  sources: [],
  sourcesLoaded: false,
  selectedSourceId: null,
  previewStream: null,
  permissions: null,
  status: 'idle',
  recordingStartedAt: null,
  withMic: true,
  error: null,
  inputHookDegraded: false,
  lastSession: null,

  async loadSources() {
    const sources = await window.api.getSources()
    set({ sources, sourcesLoaded: true })
  },

  async refreshPermissions() {
    set({ permissions: await window.api.getPermissions() })
  },

  async selectSource(id) {
    if (get().status !== 'idle') return
    set({ selectedSourceId: id, error: null })
    // 选中即建立预览流（spec 场景：预览确认后允许开始录制）
    try {
      const stream = await recorder.acquireStream(id)
      // 期间用户可能改选了其他源
      if (get().selectedSourceId === id) {
        set({ previewStream: stream })
      }
    } catch {
      set({
        previewStream: null,
        error: {
          code: 'PERMISSION_DENIED',
          message: '无法获取屏幕画面：请检查屏幕录制权限后重试'
        }
      })
      await get().refreshPermissions()
    }
  },

  setWithMic(v) {
    set({ withMic: v })
  },

  setView(v) {
    set({ view: v })
  },

  clearError() {
    set({ error: null })
  },

  async startRecording() {
    const { selectedSourceId, withMic } = get()
    if (!selectedSourceId || get().status !== 'idle') return
    set({ error: null, inputHookDegraded: false })
    // 复用预览流；未建立（如刚刷新过源列表）则现取
    if (!recorder.hasStream) {
      try {
        await recorder.acquireStream(selectedSourceId)
      } catch {
        // 含 macOS 屏幕录制权限被拒的场景（getUserMedia NotAllowedError）
        set({
          error: {
            code: 'PERMISSION_DENIED',
            message: '无法获取屏幕画面：请检查屏幕录制权限后重试'
          }
        })
        await get().refreshPermissions()
        return
      }
    }
    let result: StartRecordingResult
    try {
      result = await recorder.start(withMic)
    } catch (err) {
      recorder.releaseStream()
      set({
        error: {
          code: 'RECORDER_FAILED',
          message: `启动录制失败: ${err instanceof Error ? err.message : String(err)}`
        }
      })
      return
    }
    set({
      status: 'recording',
      recordingStartedAt: Date.now(),
      inputHookDegraded: !result.inputHookAvailable
    })
  },

  async stopRecording() {
    if (get().status !== 'recording') return
    set({ status: 'stopping' })
    try {
      const result = await recorder.stop()
      set({ status: 'idle', lastSession: result, previewStream: null, recordingStartedAt: null })
    } catch (err) {
      set({
        status: 'idle',
        recordingStartedAt: null,
        error: {
          code: 'UNKNOWN',
          message: `停止录制失败: ${err instanceof Error ? err.message : String(err)}`
        }
      })
    }
  },

  handleFatal(err) {
    // 源断开/磁盘不足/编码器异常：终止录制，已落盘片段保留
    void recorder.abort()
    set({ status: 'idle', error: err, previewStream: null, recordingStartedAt: null })
  }
}))

// Main 推送的录制错误（如 ENOSPC 写盘失败）
window.api.onRecordingError((err) => {
  useAppStore.getState().handleFatal(err)
})
