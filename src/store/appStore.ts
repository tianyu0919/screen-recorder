import { create } from 'zustand'
import type {
  CaptureSource,
  PermissionStatus,
  RecordingError
} from '@shared/types'
import { ScreenRecorder } from '@/recorder/screenRecorder'
import {
  microphoneCaptureFailed,
  microphoneIntent,
  reconcileMicrophoneEnabled
} from '@/lib/microphonePermission'

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
  microphonePermissionPending: boolean
  error: RecordingError | null
  /** 输入钩子降级提示 */
  inputHookDegraded: boolean
  lastSession: { dir: string; sessionId: string } | null

  loadSources(): Promise<void>
  refreshPermissions(): Promise<void>
  selectSource(id: string): Promise<void>
  setWithMic(v: boolean): Promise<void>
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
  withMic: false,
  microphonePermissionPending: false,
  error: null,
  inputHookDegraded: false,
  lastSession: null,

  async loadSources() {
    const sources = await window.api.getSources()
    const selectedSourceId = get().selectedSourceId
    if (selectedSourceId && !sources.some((source) => source.id === selectedSourceId)) {
      await window.api.hideDisplaySelectionOutline()
      set({ sources, sourcesLoaded: true, selectedSourceId: null, previewStream: null })
      return
    }
    set({ sources, sourcesLoaded: true })
  },

  async refreshPermissions() {
    const permissions = await window.api.getPermissions()
    set((state) => ({
      permissions,
      withMic: reconcileMicrophoneEnabled(
        state.permissions,
        permissions.microphone,
        state.withMic
      )
    }))
  },

  async selectSource(id) {
    if (get().status !== 'idle') return
    if (get().selectedSourceId === id) {
      recorder.releaseStream()
      set({ selectedSourceId: null, previewStream: null, error: null })
      await window.api.hideDisplaySelectionOutline()
      return
    }
    const source = get().sources.find((item) => item.id === id)
    set({ selectedSourceId: id, error: null })
    // 选中即建立预览流（spec 场景：预览确认后允许开始录制）
    try {
      const outlineRequest = source?.type === 'screen'
        ? window.api.showDisplaySelectionOutline(id)
        : window.api.hideDisplaySelectionOutline()
      const [stream] = await Promise.all([recorder.acquireStream(id), outlineRequest])
      // 期间用户可能改选了其他源
      if (get().selectedSourceId === id) {
        set({ previewStream: stream })
      }
    } catch {
      if (get().selectedSourceId !== id) return
      await window.api.hideDisplaySelectionOutline()
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

  async setWithMic(v) {
    if (get().status !== 'idle' || get().microphonePermissionPending) return
    if (!v) {
      set({ withMic: false })
      return
    }

    const permission = get().permissions?.microphone ?? 'unknown'
    const intent = microphoneIntent(permission)
    if (intent === 'enable') {
      set({ withMic: true, error: null })
      return
    }
    if (intent === 'settings') {
      set({
        withMic: false,
        error: { code: 'PERMISSION_DENIED', message: '请在系统设置中允许 Lenza 使用麦克风' }
      })
      try {
        await window.api.openSystemSettings('microphone')
      } catch {
        set({
          error: { code: 'PERMISSION_DENIED', message: '无法打开系统设置，请手动允许 Lenza 使用麦克风' }
        })
      }
      return
    }

    set({ microphonePermissionPending: true, error: null })
    try {
      const microphone = await window.api.requestMicrophoneAccess()
      set((state) => ({
        permissions: state.permissions ? { ...state.permissions, microphone } : state.permissions,
        withMic: microphone === 'granted',
        error:
          microphone === 'granted'
            ? null
            : { code: 'PERMISSION_DENIED', message: '麦克风未授权；仍可关闭麦克风继续录制' }
      }))
    } catch {
      set({
        withMic: false,
        error: { code: 'PERMISSION_DENIED', message: '无法申请麦克风权限，请前往系统设置授权' }
      })
    } finally {
      set({ microphonePermissionPending: false })
    }
  },

  setView(v) {
    set({ view: v })
    if (v === 'preview') {
      void window.api.hideDisplaySelectionOutline()
      return
    }
    const { selectedSourceId, sources, status } = get()
    const selected = sources.find((source) => source.id === selectedSourceId)
    if (status === 'idle' && selected?.type === 'screen') {
      void window.api.showDisplaySelectionOutline(selected.id)
    }
  },

  clearError() {
    set({ error: null })
  },

  async startRecording() {
    const { selectedSourceId } = get()
    if (!selectedSourceId || get().status !== 'idle') return
    await window.api.hideDisplaySelectionOutline()
    set({ error: null, inputHookDegraded: false })
    const wantedMic = get().withMic
    await get().refreshPermissions()
    const withMic = get().withMic && get().permissions?.microphone === 'granted'
    if (wantedMic && !withMic) {
      set({
        error: { code: 'PERMISSION_DENIED', message: '麦克风权限不可用，本次将不录制麦克风' }
      })
    }
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
    let result: Awaited<ReturnType<typeof recorder.start>>
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
      inputHookDegraded: !result.inputHookAvailable,
      error:
        microphoneCaptureFailed(withMic, result.microphoneAvailable)
          ? { code: 'PERMISSION_DENIED', message: '麦克风采集失败，本次已降级为无麦克风录制' }
          : get().error
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
    void window.api.hideDisplaySelectionOutline()
    void recorder.abort()
    set({ status: 'idle', error: err, previewStream: null, recordingStartedAt: null })
  }
}))

// Main 推送的录制错误（如 ENOSPC 写盘失败）
window.api.onRecordingError((err) => {
  useAppStore.getState().handleFatal(err)
})
