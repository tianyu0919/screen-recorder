import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../../shared/ipc'
import type { SessionEditSaveResult } from '../../shared/edit'
import type {
  CaptureSource,
  ExportFormat,
  ExportSaveResult,
  PermissionStatus,
  RecordingError,
  RecordingSession,
  SessionLoadResult,
  StartRecordingPayload,
  StartRecordingResult
} from '../../shared/types'
import type { AppSettings, CloseDecision, UpdateSnapshot } from '../../shared/types'

export interface RecorderApi {
  /** 运行平台（Renderer 侧平台分支统一以此判断，禁直接用 navigator.userAgent） */
  readonly platform: NodeJS.Platform
  getSources(): Promise<CaptureSource[]>
  /** 调 getDisplayMedia 前先告知 Main 选中的源（SCK handler 据此 approve） */
  prepareCaptureSource(sourceId: string): Promise<void>
  getPermissions(): Promise<PermissionStatus>
  openSystemSettings(kind: 'screen' | 'accessibility' | 'microphone'): Promise<void>
  startRecording(payload: StartRecordingPayload): Promise<StartRecordingResult>
  writeChunk(chunk: ArrayBuffer): Promise<void>
  writeMic(wav: ArrayBuffer): Promise<void>
  /** 系统音频 WAV 落盘（kr-01 system-audio，可选轨） */
  writeSystemAudio(wav: ArrayBuffer): Promise<void>
  stopRecording(): Promise<{ dir: string; sessionId: string } | null>
  abortRecording(): Promise<void>
  /** 枚举已落盘的录制会话（kr-02 预览） */
  listSessions(): Promise<RecordingSession[]>
  /** 加载会话：events.json 原文 + media:// 视频流式 URL */
  loadSession(sessionId: string): Promise<SessionLoadResult>
  /** 在系统文件管理器（macOS Finder）中显示会话文件位置 */
  revealSession(sessionId: string): Promise<void>
  saveSessionEdit(sessionId: string, json: string): Promise<SessionEditSaveResult>
  saveSessionAudioAsset(
    sessionId: string,
    assetId: string,
    name: string,
    data: ArrayBuffer
  ): Promise<string>
  loadSessionAudioAsset(sessionId: string, assetFile: string): Promise<ArrayBuffer>
  deleteSessionAudioAsset(sessionId: string, assetFile: string): Promise<void>
  trashSession(sessionId: string): Promise<void>
  restoreSession(sessionId: string): Promise<void>
  deleteSessionPermanent(sessionId: string): Promise<void>
  emptyTrash(): Promise<void>
  removeMissingSession(sessionId: string): Promise<void>
  getSettings(): Promise<AppSettings>
  updateSettings(patch: Partial<Pick<AppSettings, 'theme' | 'trashRetentionDays' | 'closeBehavior' | 'autoCheckUpdates'>>): Promise<AppSettings>
  chooseRecordingsPath(): Promise<AppSettings | null>
  openRecordingsPath(): Promise<void>
  getUpdateState(): Promise<UpdateSnapshot>
  checkForUpdates(): Promise<UpdateSnapshot>
  downloadUpdate(): Promise<void>
  installUpdate(): Promise<void>
  openUpdateRelease(): Promise<void>
  onUpdateStatusChanged(cb: (snapshot: UpdateSnapshot) => void): () => void
  /** 保存导出产物（kr-03）：弹保存对话框并写盘；用户取消返回 null */
  saveExport(
    sessionId: string,
    data: ArrayBuffer,
    format: ExportFormat
  ): Promise<ExportSaveResult | null>
  /** 选择自定义音轨文件（kr-05 custom-audio-track）：对话框 + 读 bytes；取消返回 null */
  pickAudioFile(): Promise<{ name: string; path: string; data: ArrayBuffer } | null>
  /** 窗口控制（Windows 自绘标题栏按钮） */
  windowMinimize(): Promise<void>
  windowToggleMaximize(): Promise<void>
  windowClose(): Promise<void>
  resolveWindowClose(decision: CloseDecision): Promise<void>
  onWindowCloseRequested(cb: () => void): () => void
  /** 最大化状态变化（切换 最大化/还原 图标） */
  onMaximizedChange(cb: (maximized: boolean) => void): () => void
  onRecordingError(cb: (err: RecordingError) => void): () => void
  onRecordingStopped(cb: (result: { dir: string; sessionId: string }) => void): () => void
}

const api: RecorderApi = {
  platform: process.platform,
  getSources: () => ipcRenderer.invoke(IPC.GetSources),
  prepareCaptureSource: (sourceId) => ipcRenderer.invoke(IPC.PrepareCaptureSource, sourceId),
  getPermissions: () => ipcRenderer.invoke(IPC.GetPermissions),
  openSystemSettings: (kind) => ipcRenderer.invoke(IPC.OpenSystemSettings, kind),
  startRecording: (payload) => ipcRenderer.invoke(IPC.RecordingStart, payload),
  writeChunk: (chunk) => ipcRenderer.invoke(IPC.RecordingWriteChunk, chunk),
  writeMic: (wav) => ipcRenderer.invoke(IPC.RecordingWriteMic, wav),
  writeSystemAudio: (wav) => ipcRenderer.invoke(IPC.RecordingWriteSystemAudio, wav),
  stopRecording: () => ipcRenderer.invoke(IPC.RecordingStop),
  abortRecording: () => ipcRenderer.invoke('recording:abort'),
  listSessions: () => ipcRenderer.invoke(IPC.SessionList),
  loadSession: (sessionId) => ipcRenderer.invoke(IPC.SessionLoad, sessionId),
  revealSession: (sessionId) => ipcRenderer.invoke(IPC.SessionReveal, sessionId),
  saveSessionEdit: (sessionId, json) =>
    ipcRenderer.invoke(IPC.SessionSaveEdit, sessionId, json),
  saveSessionAudioAsset: (sessionId, assetId, name, data) =>
    ipcRenderer.invoke(IPC.SessionSaveAudioAsset, sessionId, assetId, name, data),
  loadSessionAudioAsset: (sessionId, assetFile) =>
    ipcRenderer.invoke(IPC.SessionLoadAudioAsset, sessionId, assetFile),
  deleteSessionAudioAsset: (sessionId, assetFile) =>
    ipcRenderer.invoke(IPC.SessionDeleteAudioAsset, sessionId, assetFile),
  trashSession: (sessionId) => ipcRenderer.invoke(IPC.SessionTrash, sessionId),
  restoreSession: (sessionId) => ipcRenderer.invoke(IPC.SessionRestore, sessionId),
  deleteSessionPermanent: (sessionId) => ipcRenderer.invoke(IPC.SessionDeletePermanent, sessionId),
  emptyTrash: () => ipcRenderer.invoke(IPC.SessionEmptyTrash),
  removeMissingSession: (sessionId) => ipcRenderer.invoke(IPC.SessionRemoveMissing, sessionId),
  getSettings: () => ipcRenderer.invoke(IPC.SettingsGet),
  updateSettings: (patch) => ipcRenderer.invoke(IPC.SettingsUpdate, patch),
  chooseRecordingsPath: () => ipcRenderer.invoke(IPC.SettingsChooseRecordingsPath),
  openRecordingsPath: () => ipcRenderer.invoke(IPC.SettingsOpenRecordingsPath),
  getUpdateState: () => ipcRenderer.invoke(IPC.UpdateGetState),
  checkForUpdates: () => ipcRenderer.invoke(IPC.UpdateCheck),
  downloadUpdate: () => ipcRenderer.invoke(IPC.UpdateDownload),
  installUpdate: () => ipcRenderer.invoke(IPC.UpdateInstall),
  openUpdateRelease: () => ipcRenderer.invoke(IPC.UpdateOpenRelease),
  onUpdateStatusChanged: (cb) => {
    const listener = (_e: Electron.IpcRendererEvent, snapshot: UpdateSnapshot): void => cb(snapshot)
    ipcRenderer.on(IPC.UpdateStatusChanged, listener)
    return () => ipcRenderer.removeListener(IPC.UpdateStatusChanged, listener)
  },
  saveExport: (sessionId, data, format) =>
    ipcRenderer.invoke(IPC.ExportSave, sessionId, data, format),
  pickAudioFile: () => ipcRenderer.invoke(IPC.PickAudioFile),
  windowMinimize: () => ipcRenderer.invoke(IPC.WindowMinimize),
  windowToggleMaximize: () => ipcRenderer.invoke(IPC.WindowToggleMaximize),
  windowClose: () => ipcRenderer.invoke(IPC.WindowClose),
  resolveWindowClose: (decision) => ipcRenderer.invoke(IPC.WindowResolveClose, decision),
  onWindowCloseRequested: (cb) => {
    const listener = (): void => cb()
    ipcRenderer.on(IPC.WindowCloseRequested, listener)
    return () => ipcRenderer.removeListener(IPC.WindowCloseRequested, listener)
  },
  onMaximizedChange: (cb) => {
    const listener = (_e: Electron.IpcRendererEvent, maximized: boolean): void => cb(maximized)
    ipcRenderer.on(IPC.WindowMaximizeChanged, listener)
    return () => ipcRenderer.removeListener(IPC.WindowMaximizeChanged, listener)
  },
  onRecordingError: (cb) => {
    const listener = (_e: Electron.IpcRendererEvent, err: RecordingError): void => cb(err)
    ipcRenderer.on(IPC.RecordingError, listener)
    return () => ipcRenderer.removeListener(IPC.RecordingError, listener)
  },
  onRecordingStopped: (cb) => {
    const listener = (
      _e: Electron.IpcRendererEvent,
      result: { dir: string; sessionId: string }
    ): void => cb(result)
    ipcRenderer.on(IPC.RecordingStopped, listener)
    return () => ipcRenderer.removeListener(IPC.RecordingStopped, listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
