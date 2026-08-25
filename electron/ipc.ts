import { app, ipcMain, dialog, shell, type BrowserWindow } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { IPC } from '../shared/ipc'
import type { SessionEditSaveResult } from '../shared/edit'
import type { CaptionsDocument, StartTranscriptionRequest } from '../shared/captions'
import type {
  ExportFormat,
  ExportSaveResult,
  StartRecordingPayload,
  StartRecordingResult
} from '../shared/types'
import type { SaveSessionThumbnailRequest } from '../shared/sessionThumbnail'
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
import { saveCaptionsDocument } from './store/captionsStore'
import { transcriptionService } from './transcription/service'
import { sessionThumbnailCache } from './store/sessionThumbnailCache'
import { setExportBusy } from './export/exportActivity'
import { saveExportWithoutOverwrite } from './export/saveExport'
import { normalizeSessionDisplayName } from '../shared/sessionName'

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
  ipcMain.handle(IPC.SessionList, (_event, refresh = false) => listSessions(refresh === true))
  ipcMain.handle(IPC.SessionLoad, (_e, sessionId: string) => loadSession(sessionId))
  ipcMain.handle(IPC.SessionRename, (_e, sessionId: string, displayName: string) =>
    sessionCatalog.renameDisplayName(sessionId, displayName)
  )
  ipcMain.handle(IPC.SessionReveal, (_e, sessionId: string) => revealSession(sessionId))
  ipcMain.handle(IPC.SessionTrash, (_e, sessionId: string) => {
    transcriptionService.cancel(sessionId)
    return sessionCatalog.trash(sessionId)
  })
  ipcMain.handle(IPC.SessionRestore, (_e, sessionId: string) => sessionCatalog.restore(sessionId))
  ipcMain.handle(IPC.SessionDeletePermanent, async (_e, sessionId: string) => {
    transcriptionService.cancel(sessionId)
    await sessionCatalog.deletePermanent(sessionId)
    await sessionThumbnailCache.remove(sessionId)
  })
  ipcMain.handle(IPC.SessionEmptyTrash, async () => {
    transcriptionService.cancelAll()
    const ids = sessionCatalog.list().filter((session) => session.lifecycle === 'trashed')
      .map((session) => session.sessionId)
    await sessionCatalog.emptyTrash()
    await Promise.all(ids.map((sessionId) => sessionThumbnailCache.remove(sessionId)))
  })
  ipcMain.handle(IPC.SessionRemoveMissing, async (_e, sessionId: string) => {
    await sessionCatalog.removeMissing(sessionId)
    await sessionThumbnailCache.remove(sessionId)
  })
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
  ipcMain.handle(IPC.SettingsChooseExportPath, async () => {
    const win = getWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] })
    if (result.canceled || !result.filePaths[0]) return null
    return appSettings.setExportPath(result.filePaths[0])
  })
  ipcMain.handle(IPC.SettingsOpenExportPath, () => shell.openPath(appSettings.get().exportPath))
  ipcMain.handle(IPC.ExportChooseDirectory, async () => {
    const win = getWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] })
    return result.canceled ? null : result.filePaths[0] ?? null
  })
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
    IPC.SessionSaveCaptions,
    (_e, sessionId: string, document: CaptionsDocument) =>
      saveCaptionsDocument(sessionId, document)
  )
  ipcMain.handle(IPC.SessionSaveThumbnail, (_e, request: SaveSessionThumbnailRequest) =>
    sessionThumbnailCache.save(request)
  )
  ipcMain.handle(IPC.SessionExportSrt, async (_e, sessionId: string, srt: string) => {
    const win = getWindow()
    if (!win) return null
    const result = await dialog.showSaveDialog(win, {
      defaultPath: `${sessionCatalog.displayNameFor(sessionId)}.srt`,
      filters: [{ name: 'SRT 字幕', extensions: ['srt'] }]
    })
    if (result.canceled || !result.filePath) return null
    await writeFile(result.filePath, srt, 'utf8')
    return { path: result.filePath }
  })
  ipcMain.handle(IPC.SessionImportSrt, async () => {
    const win = getWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'], filters: [{ name: 'SRT 字幕', extensions: ['srt'] }]
    })
    const path = result.filePaths[0]
    if (result.canceled || !path) return null
    return { name: basename(path), source: await readFile(path, 'utf8') }
  })

  ipcMain.handle(IPC.TranscriptionModels, () => transcriptionService.listModels())
  ipcMain.handle(IPC.TranscriptionGet, (_e, sessionId: string) => transcriptionService.snapshot(sessionId))
  ipcMain.handle(IPC.TranscriptionStart, (_e, request: StartTranscriptionRequest) =>
    transcriptionService.start(request)
  )
  ipcMain.handle(IPC.TranscriptionCancel, (_e, sessionId: string) =>
    transcriptionService.cancel(sessionId)
  )
  ipcMain.handle(IPC.TranscriptionImportModel, async () => {
    const win = getWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'], filters: [{ name: 'Whisper 模型', extensions: ['bin'] }]
    })
    const path = result.filePaths[0]
    if (result.canceled || !path) return null
    return transcriptionService.importModel(path)
  })
  ipcMain.handle(IPC.TranscriptionDeleteModel, (_e, modelId: string) =>
    transcriptionService.deleteModel(modelId)
  )
  transcriptionService.onStatus((snapshot) => {
    const win = getWindow()
    if (win && !win.isDestroyed()) win.webContents.send(IPC.TranscriptionStatusChanged, snapshot)
  })
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
      displayName: string,
      data: ArrayBuffer,
      format: ExportFormat,
      directory?: string
    ): Promise<ExportSaveResult | null> => {
      const targetDirectory = directory || appSettings.get().exportPath
      sessionCatalog.resolveSessionDir(sessionId)
      const path = await saveExportWithoutOverwrite(
        targetDirectory, normalizeSessionDisplayName(displayName), format, data
      )
      return { path }
    }
  )
  ipcMain.handle(IPC.ExportSetBusy, (_event, busy: boolean) => setExportBusy(busy === true))

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
