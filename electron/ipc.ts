import { ipcMain, screen, desktopCapturer, dialog, type BrowserWindow } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { join, basename } from 'node:path'
import { IPC } from '../shared/ipc'
import type { SessionEditSaveResult } from '../shared/edit'
import type {
  ExportFormat,
  ExportSaveResult,
  RecordingEvents,
  RecordingError,
  StartRecordingPayload,
  StartRecordingResult
} from '../shared/types'
import { listCaptureSources, setPendingCaptureSource } from './capture/sources'
import { startSystemAudioCapture, type StopSystemAudio } from './capture/systemAudio'
import { CursorPoller } from './input/cursorPoller'
import { InputHook } from './input/uiohook'
import { SessionStore } from './store/sessionStore'
import { listSessions, loadSession, revealSession } from './store/sessionReader'
import {
  deleteAudioAsset,
  loadAudioAsset,
  saveAudioAsset,
  saveEditJson
} from './store/editStore'
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
  let stopSystemAudio: StopSystemAudio | null = null

  ipcMain.handle(IPC.GetSources, () => listCaptureSources())

  // 窗口控制（Windows 自绘标题栏按钮；macOS 用系统红绿灯，不会触发）
  ipcMain.handle(IPC.WindowMinimize, () => getWindow()?.minimize())
  ipcMain.handle(IPC.WindowToggleMaximize, () => {
    const w = getWindow()
    if (!w) return
    if (w.isMaximized()) w.unmaximize()
    else w.maximize()
  })
  ipcMain.handle(IPC.WindowClose, () => getWindow()?.close())

  // 录制会话读取（kr-02 预览）：枚举 / 加载 events.json + 视频流式 URL
  ipcMain.handle(IPC.SessionList, () => listSessions())
  ipcMain.handle(IPC.SessionLoad, (_e, sessionId: string) => loadSession(sessionId))
  ipcMain.handle(IPC.SessionReveal, (_e, sessionId: string) => revealSession(sessionId))
  ipcMain.handle(
    IPC.SessionSaveEdit,
    (_e, sessionId: string, json: string): Promise<SessionEditSaveResult> =>
      saveEditJson(sessionId, json)
  )
  ipcMain.handle(
    IPC.SessionSaveAudioAsset,
    (_e, sessionId: string, assetId: string, name: string, data: ArrayBuffer) =>
      saveAudioAsset(sessionId, assetId, name, data)
  )
  ipcMain.handle(
    IPC.SessionLoadAudioAsset,
    (_e, sessionId: string, assetFile: string) => loadAudioAsset(sessionId, assetFile)
  )
  ipcMain.handle(
    IPC.SessionDeleteAudioAsset,
    (_e, sessionId: string, assetFile: string) => deleteAudioAsset(sessionId, assetFile)
  )

  // 导出产物保存（kr-03）：内存中的 mp4/webm 经保存对话框落盘，用户取消返回 null
  ipcMain.handle(
    IPC.ExportSave,
    async (
      _e,
      sessionId: string,
      data: ArrayBuffer,
      format: ExportFormat
    ): Promise<ExportSaveResult | null> => {
      const win = getWindow()
      if (!win) return null
      const result = await dialog.showSaveDialog(win, {
        defaultPath: `${sessionId}.${format}`,
        filters: [
          format === 'mp4'
            ? { name: 'MP4 视频', extensions: ['mp4'] }
            : { name: 'WebM 视频', extensions: ['webm'] }
        ]
      })
      if (result.canceled || !result.filePath) return null
      await writeFile(result.filePath, Buffer.from(data))
      return { path: result.filePath }
    }
  )

  // 自定义音轨文件选择（kr-05 custom-audio-track）：对话框选音频 → 读 bytes 回 Renderer 解码
  // （预览用 blobUrl、导出用 PCM；不走 media:// 协议——它只放行 recordings 目录）
  ipcMain.handle(
    IPC.PickAudioFile,
    async (): Promise<{ name: string; path: string; data: ArrayBuffer } | null> => {
      const win = getWindow()
      if (!win) return null
      const result = await dialog.showOpenDialog(win, {
        properties: ['openFile'],
        filters: [
          { name: '音频文件', extensions: ['wav', 'mp3', 'm4a', 'aac', 'ogg', 'flac'] }
        ]
      })
      const filePath = result.filePaths[0]
      if (result.canceled || !filePath) return null
      const buf = await readFile(filePath)
      if (buf.byteLength > 200 * 1024 * 1024) throw new Error('音频文件过大（上限 200MB）')
      // 复制为独立 ArrayBuffer（Buffer 的底层 slab 可能带偏移，结构化克隆需精确边界）
      const data = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
      return { name: basename(filePath), path: filePath, data }
    }
  )

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
    // macOS 原生系统音频（ScreenCaptureKit helper）；不可用（Windows/无 helper）返回 null 静默降级
    stopSystemAudio = startSystemAudioCapture(join(session.dir, 'system.wav'))

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

  ipcMain.handle(IPC.RecordingWriteSystemAudio, (_e, wav: ArrayBuffer) => {
    store.writeSystemAudio(Buffer.from(wav))
  })

  ipcMain.handle(IPC.RecordingStop, async () => {
    poller.stop()
    inputHook.stopRecording()
    // 先停系统音频 helper（stdin EOF 后 patch WAV header），再判断会话有效性，避免残留
    await stopSystemAudio?.()
    stopSystemAudio = null
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
    await stopSystemAudio?.()
    stopSystemAudio = null
    await store.abort()
  })

  return { inputHook }
}
