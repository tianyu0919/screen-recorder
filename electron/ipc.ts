import { app, ipcMain, dialog, shell, type BrowserWindow } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { IPC } from '../shared/ipc'
import type { SessionEditSaveResult } from '../shared/edit'
import type {
  ExportFormat,
  ExportSaveResult,
  StartRecordingPayload,
  StartRecordingResult
} from '../shared/types'
import { listCaptureSources, setPendingCaptureSource } from './capture/sources'
import { InputHook } from './input/uiohook'
import { listSessions, loadSession, revealSession } from './store/sessionReader'
import {
  deleteAudioAsset,
  loadAudioAsset,
  saveAudioAsset,
  saveEditJson
} from './store/editStore'
import { getPermissionStatus, openSystemSettings, requestMicrophoneAccess } from './permissions'
import { appSettings } from './store/appSettings'
import { sessionCatalog } from './store/sessionCatalog'
import type { AppSettingsPatch, CloseDecision } from '../shared/types'
import { backgroundWindow } from './windowLifecycle'
import { updateService } from './updater'
import { displaySelectionOutline } from './displaySelectionOutline'
import { registerRecordingIpc } from './capture/recordingIpc'

export type { StartRecordingPayload, StartRecordingResult }

export function registerIpc(getWindow: () => BrowserWindow | null, appIcon?: Electron.NativeImage): {
  inputHook: InputHook
} {
  ipcMain.handle(IPC.GetSources, () => listCaptureSources())
  ipcMain.handle(IPC.ShowDisplaySelectionOutline, (_e, sourceId: string) =>
    displaySelectionOutline.showForSource(sourceId).catch(() => false)
  )
  ipcMain.handle(IPC.HideDisplaySelectionOutline, () => displaySelectionOutline.hide())

  // 窗口控制（Windows 自绘标题栏按钮；专注预览在双平台复用最大化能力）
  ipcMain.handle(IPC.WindowMinimize, () => getWindow()?.minimize())
  ipcMain.handle(IPC.WindowIsMaximized, () => getWindow()?.isMaximized() ?? false)
  ipcMain.handle(IPC.WindowSetMaximized, (_event, maximized: boolean) => {
    const w = getWindow()
    if (!w || w.isMaximized() === maximized) return
    if (maximized) w.maximize()
    else w.unmaximize()
  })
  ipcMain.handle(IPC.WindowToggleMaximize, () => {
    const w = getWindow()
    if (!w) return
    if (w.isMaximized()) w.unmaximize()
    else w.maximize()
  })
  ipcMain.handle(IPC.WindowClose, () => getWindow()?.close())
  ipcMain.handle(IPC.WindowResolveClose, (_event, decision: CloseDecision) => {
    const win = getWindow()
    if (!win) return
    if (decision.remember) appSettings.update({ closeBehavior: decision.behavior })
    if (decision.behavior === 'background') backgroundWindow(win, appIcon)
    else app.quit()
  })

  // 录制会话读取（kr-02 预览）：枚举 / 加载 events.json + 视频流式 URL
  ipcMain.handle(IPC.SessionList, () => listSessions())
  ipcMain.handle(IPC.SessionLoad, (_e, sessionId: string) => loadSession(sessionId))
  ipcMain.handle(IPC.SessionReveal, (_e, sessionId: string) => revealSession(sessionId))
  ipcMain.handle(IPC.SessionTrash, (_e, sessionId: string) => sessionCatalog.trash(sessionId))
  ipcMain.handle(IPC.SessionRestore, (_e, sessionId: string) => sessionCatalog.restore(sessionId))
  ipcMain.handle(IPC.SessionDeletePermanent, (_e, sessionId: string) => sessionCatalog.deletePermanent(sessionId))
  ipcMain.handle(IPC.SessionEmptyTrash, () => sessionCatalog.emptyTrash())
  ipcMain.handle(IPC.SessionRemoveMissing, (_e, sessionId: string) => sessionCatalog.removeMissing(sessionId))
  ipcMain.handle(IPC.SettingsGet, () => appSettings.get())
  ipcMain.handle(IPC.SettingsUpdate, async (_e, patch: AppSettingsPatch) => {
    const settings = appSettings.update(patch)
    await sessionCatalog.updateRetention()
    return settings
  })
  ipcMain.handle(IPC.SettingsChooseRecordingsPath, async () => {
    const win = getWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] })
    if (result.canceled || !result.filePaths[0]) return null
    return appSettings.setRecordingsPath(result.filePaths[0])
  })
  ipcMain.handle(IPC.SettingsOpenRecordingsPath, () => shell.openPath(appSettings.get().recordingsPath))
  ipcMain.handle(IPC.UpdateGetState, () => updateService.snapshot())
  ipcMain.handle(IPC.UpdateCheck, () => updateService.check())
  ipcMain.handle(IPC.UpdateDownload, () => updateService.download())
  ipcMain.handle(IPC.UpdateInstall, () => updateService.install())
  ipcMain.handle(IPC.UpdateOpenRelease, () => updateService.openRelease())
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

  ipcMain.handle(IPC.RequestMicrophoneAccess, () => requestMicrophoneAccess())

  ipcMain.handle(IPC.OpenSystemSettings, (_e, kind: 'screen' | 'accessibility' | 'microphone') =>
    openSystemSettings(kind)
  )

  const inputHook = registerRecordingIpc(getWindow)
  return { inputHook }
}
