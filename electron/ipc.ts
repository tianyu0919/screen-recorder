import { ipcMain, screen, desktopCapturer, type BrowserWindow } from 'electron'
import { IPC } from '../shared/ipc'
import type {
  RecordingEvents,
  RecordingError,
  StartRecordingPayload,
  StartRecordingResult
} from '../shared/types'
import { listCaptureSources, setPendingCaptureSource } from './capture/sources'
import { CursorPoller } from './input/cursorPoller'
import { InputHook } from './input/uiohook'
import { SessionStore } from './store/sessionStore'
import { listSessions, loadSession, revealSession } from './store/sessionReader'
import { getPermissionStatus, openSystemSettings, requestMicrophoneAccess } from './permissions'

/** 鼠标轨迹轮询频率（spec: 60–120Hz，取 90Hz） */
const POLL_HZ = 90

export type { StartRecordingPayload, StartRecordingResult }

export function registerIpc(getWindow: () => BrowserWindow | null): {
  inputHook: InputHook
} {
  const poller = new CursorPoller()
  const inputHook = new InputHook()

  const sendError = (code: RecordingError['code'], message: string): void => {
    getWindow()?.webContents.send(IPC.RecordingError, { code, message } satisfies RecordingError)
  }

  const store = new SessionStore((code, message) => {
    // 写盘失败（如 ENOSPC）：上报 Renderer，由 UI 终止录制并保留片段
    sendError(code, message)
  })

  let t0 = 0
  let videoMeta: StartRecordingPayload['video'] | null = null
  let displayInfo: RecordingEvents['display'] | null = null

  ipcMain.handle(IPC.GetSources, () => listCaptureSources())

  // 录制会话读取（kr-02 预览）：枚举 / 加载 events.json + 视频流式 URL
  ipcMain.handle(IPC.SessionList, () => listSessions())
  ipcMain.handle(IPC.SessionLoad, (_e, sessionId: string) => loadSession(sessionId))
  ipcMain.handle(IPC.SessionReveal, (_e, sessionId: string) => revealSession(sessionId))

  // Renderer 在调 getDisplayMedia 前告知选中的源（SCK handler 据此 approve）
  ipcMain.handle(IPC.PrepareCaptureSource, (_e, sourceId: string) => {
    setPendingCaptureSource(sourceId)
  })

  ipcMain.handle(IPC.GetPermissions, () => getPermissionStatus())

  ipcMain.handle(IPC.OpenSystemSettings, (_e, kind: 'screen' | 'accessibility' | 'microphone') =>
    openSystemSettings(kind)
  )

  ipcMain.handle(IPC.RecordingStart, async (_e, payload: StartRecordingPayload) => {
    if (store.hasActiveSession()) throw new Error('已有进行中的录制会话')
    await inputHook.init()

    const session = store.startSession()
    t0 = Date.now()
    videoMeta = payload.video

    // 记录"被录制源所在"的显示器信息，供多屏/scaleFactor 换算：
    // screen 源按 desktopCapturer 的 display_id 精确匹配；
    // window 源无 display_id，回退到光标所在显示器的近似值
    let disp = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    if (payload.sourceId.startsWith('screen')) {
      const screenSources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 0, height: 0 }
      })
      const matched = screenSources.find((s) => s.id === payload.sourceId)
      const byDisplayId = screen
        .getAllDisplays()
        .find((d) => matched !== undefined && String(d.id) === matched.display_id)
      if (byDisplayId) disp = byDisplayId
    }
    displayInfo = {
      id: disp.id,
      bounds: [disp.bounds.x, disp.bounds.y, disp.bounds.width, disp.bounds.height],
      scaleFactor: disp.scaleFactor
    }

    poller.start(POLL_HZ, t0)
    inputHook.startRecording(t0)

    if (!inputHook.available) {
      // 降级路径：画面 + 鼠标轨迹仍可录，明确提示点击/键盘事件未采集
      sendError(
        'INPUT_HOOK_UNAVAILABLE',
        '全局输入钩子不可用（macOS 需辅助功能权限）：点击/键盘事件未采集，自动运镜不可用'
      )
    }

    return {
      sessionId: session.sessionId,
      startTime: t0,
      display: displayInfo,
      inputHookAvailable: inputHook.available,
      inputHookError: inputHook.available ? undefined : inputHook.unavailableReason
    } satisfies StartRecordingResult
  })

  ipcMain.handle(IPC.RecordingWriteChunk, (_e, chunk: ArrayBuffer) => {
    store.writeChunk(Buffer.from(chunk))
  })

  ipcMain.handle(
    IPC.RecordingWriteMic,
    async (_e, wav: ArrayBuffer) => {
      // 写 mic.wav 前先确保麦克风权限（macOS 触发系统弹窗）
      await requestMicrophoneAccess()
      store.writeMic(Buffer.from(wav))
    }
  )

  ipcMain.handle(IPC.RecordingStop, async () => {
    poller.stop()
    inputHook.stopRecording()
    if (!store.hasActiveSession() || !videoMeta || !displayInfo) {
      return null
    }
    const events: RecordingEvents = {
      version: 1,
      startTime: t0,
      display: displayInfo,
      video: { ...videoMeta, file: 'screen.webm' },
      mouseTrack: poller.getTrack(),
      clicks: inputHook.getClicks(),
      keys: inputHook.getKeys()
    }
    const result = await store.finalize(events)
    getWindow()?.webContents.send(IPC.RecordingStopped, result)
    return result
  })

  /** 异常终止（源断开/磁盘不足）：保留已落盘片段 */
  ipcMain.handle('recording:abort', async () => {
    poller.stop()
    inputHook.stopRecording()
    await store.abort()
  })

  return { inputHook }
}
