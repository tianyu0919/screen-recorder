import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../../shared/ipc'
import type { SessionEditSaveResult } from '../../shared/edit'
import type {
  CaptionModelInfo,
  CaptionsDocument,
  StartTranscriptionRequest,
  TranscriptionSnapshot
} from '../../shared/captions'
import type {
  CaptureSource,
  ActivateRecordingResult,
  ExportFormat,
  ExportSaveResult,
  PermissionStatus,
  RecordingError,
  RecordingSession,
  SessionLoadResult,
  PrepareRecordingResult,
  StartRecordingPayload
} from '../../shared/types'
import type { SaveSessionThumbnailRequest, SessionThumbnailInfo } from '../../shared/sessionThumbnail'
import type {
  AppSettings,
  AppSettingsPatch,
  CloseDecision,
  UpdateSnapshot
} from '../../shared/types'

export interface RecorderApi {
  /** 运行平台（Renderer 侧平台分支统一以此判断，禁直接用 navigator.userAgent） */
  readonly platform: NodeJS.Platform
  getSources(): Promise<CaptureSource[]>
  /** 调 getDisplayMedia 前先告知 Main 选中的源（SCK handler 据此 approve） */
  prepareCaptureSource(sourceId: string): Promise<void>
  showDisplaySelectionOutline(sourceId: string): Promise<boolean>
  hideDisplaySelectionOutline(): Promise<void>
  getPermissions(): Promise<PermissionStatus>
  requestMicrophoneAccess(): Promise<PermissionStatus['microphone']>
  openSystemSettings(kind: 'screen' | 'accessibility' | 'microphone'): Promise<void>
  startRecording(payload: StartRecordingPayload): Promise<PrepareRecordingResult>
  activateRecording(): Promise<ActivateRecordingResult>
  writeChunk(chunk: ArrayBuffer): Promise<void>
  writeMic(wav: ArrayBuffer): Promise<void>
  /** 系统音频 WAV 落盘（kr-01 system-audio，可选轨） */
  writeSystemAudio(wav: ArrayBuffer): Promise<void>
  stopRecording(): Promise<{ dir: string; sessionId: string } | null>
  abortRecording(): Promise<void>
  /** 枚举已落盘的录制会话（kr-02 预览） */
  listSessions(refresh?: boolean): Promise<RecordingSession[]>
  /** 加载会话：events.json 原文 + media:// 视频流式 URL */
  loadSession(sessionId: string): Promise<SessionLoadResult>
  renameSession(sessionId: string, displayName: string): Promise<string>
  /** 在系统文件管理器（macOS Finder）中显示会话文件位置 */
  revealSession(sessionId: string): Promise<void>
  saveSessionEdit(sessionId: string, json: string): Promise<SessionEditSaveResult>
  saveSessionCaptions(sessionId: string, document: CaptionsDocument): Promise<{ updatedAt: number }>
  saveSessionThumbnail(request: SaveSessionThumbnailRequest): Promise<SessionThumbnailInfo>
  exportSessionSrt(sessionId: string, srt: string): Promise<ExportSaveResult | null>
  importSessionSrt(): Promise<{ name: string; source: string } | null>
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
  updateSettings(patch: AppSettingsPatch): Promise<AppSettings>
  chooseRecordingsPath(): Promise<AppSettings | null>
  openRecordingsPath(): Promise<void>
  chooseExportPath(): Promise<AppSettings | null>
  openExportPath(): Promise<void>
  chooseExportDirectory(): Promise<string | null>
  setExportBusy(busy: boolean): Promise<void>
  getUpdateState(): Promise<UpdateSnapshot>
  checkForUpdates(): Promise<UpdateSnapshot>
  downloadUpdate(): Promise<void>
  installUpdate(): Promise<void>
  openUpdateRelease(): Promise<void>
  onUpdateStatusChanged(cb: (snapshot: UpdateSnapshot) => void): () => void
  listCaptionModels(): Promise<CaptionModelInfo[]>
  getTranscription(sessionId: string): Promise<TranscriptionSnapshot>
  startTranscription(request: StartTranscriptionRequest): Promise<TranscriptionSnapshot>
  cancelTranscription(sessionId: string): Promise<TranscriptionSnapshot>
  /** 弹文件选择框导入 whisper.cpp 模型；用户取消返回 null。 */
  importCaptionModel(): Promise<CaptionModelInfo | null>
  /** 删除自定义模型并返回最新模型列表；内置模型不可删除。 */
  deleteCaptionModel(modelId: string): Promise<CaptionModelInfo[]>
  onTranscriptionStatusChanged(cb: (snapshot: TranscriptionSnapshot) => void): () => void
  /** 保存导出产物（kr-03）：弹保存对话框并写盘；用户取消返回 null */
  saveExport(
    sessionId: string,
    displayName: string,
    data: ArrayBuffer,
    format: ExportFormat,
    directory?: string
  ): Promise<ExportSaveResult | null>
  /** 在系统文件管理器中显示已导出的文件 */
  revealExport(path: string): Promise<void>
  /** 选择自定义音轨文件（kr-05 custom-audio-track）：对话框 + 读 bytes；取消返回 null */
  pickAudioFile(): Promise<{ name: string; path: string; data: ArrayBuffer } | null>
  /** 窗口控制（Windows 自绘标题栏按钮） */
  windowMinimize(): Promise<void>
  windowIsMaximized(): Promise<boolean>
  windowSetMaximized(maximized: boolean): Promise<void>
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
  showDisplaySelectionOutline: (sourceId) =>
    ipcRenderer.invoke(IPC.ShowDisplaySelectionOutline, sourceId),
  hideDisplaySelectionOutline: () => ipcRenderer.invoke(IPC.HideDisplaySelectionOutline),
  getPermissions: () => ipcRenderer.invoke(IPC.GetPermissions),
  requestMicrophoneAccess: () => ipcRenderer.invoke(IPC.RequestMicrophoneAccess),
  openSystemSettings: (kind) => ipcRenderer.invoke(IPC.OpenSystemSettings, kind),
  startRecording: (payload) => ipcRenderer.invoke(IPC.RecordingStart, payload),
  activateRecording: () => ipcRenderer.invoke(IPC.RecordingActivate),
  writeChunk: (chunk) => ipcRenderer.invoke(IPC.RecordingWriteChunk, chunk),
  writeMic: (wav) => ipcRenderer.invoke(IPC.RecordingWriteMic, wav),
  writeSystemAudio: (wav) => ipcRenderer.invoke(IPC.RecordingWriteSystemAudio, wav),
  stopRecording: () => ipcRenderer.invoke(IPC.RecordingStop),
  abortRecording: () => ipcRenderer.invoke('recording:abort'),
  listSessions: (refresh = false) => ipcRenderer.invoke(IPC.SessionList, refresh),
  loadSession: (sessionId) => ipcRenderer.invoke(IPC.SessionLoad, sessionId),
  renameSession: (sessionId, displayName) =>
    ipcRenderer.invoke(IPC.SessionRename, sessionId, displayName),
  revealSession: (sessionId) => ipcRenderer.invoke(IPC.SessionReveal, sessionId),
  saveSessionEdit: (sessionId, json) =>
    ipcRenderer.invoke(IPC.SessionSaveEdit, sessionId, json),
  saveSessionCaptions: (sessionId, document) =>
    ipcRenderer.invoke(IPC.SessionSaveCaptions, sessionId, document),
  saveSessionThumbnail: (request) => ipcRenderer.invoke(IPC.SessionSaveThumbnail, request),
  exportSessionSrt: (sessionId, srt) =>
    ipcRenderer.invoke(IPC.SessionExportSrt, sessionId, srt),
  importSessionSrt: () => ipcRenderer.invoke(IPC.SessionImportSrt),
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
  chooseExportPath: () => ipcRenderer.invoke(IPC.SettingsChooseExportPath),
  openExportPath: () => ipcRenderer.invoke(IPC.SettingsOpenExportPath),
  chooseExportDirectory: () => ipcRenderer.invoke(IPC.ExportChooseDirectory),
  setExportBusy: (busy) => ipcRenderer.invoke(IPC.ExportSetBusy, busy),
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
  listCaptionModels: () => ipcRenderer.invoke(IPC.TranscriptionModels),
  getTranscription: (sessionId) => ipcRenderer.invoke(IPC.TranscriptionGet, sessionId),
  startTranscription: (request) => ipcRenderer.invoke(IPC.TranscriptionStart, request),
  cancelTranscription: (sessionId) => ipcRenderer.invoke(IPC.TranscriptionCancel, sessionId),
  importCaptionModel: () => ipcRenderer.invoke(IPC.TranscriptionImportModel),
  deleteCaptionModel: (modelId) => ipcRenderer.invoke(IPC.TranscriptionDeleteModel, modelId),
  onTranscriptionStatusChanged: (cb) => {
    const listener = (_e: Electron.IpcRendererEvent, snapshot: TranscriptionSnapshot): void => cb(snapshot)
    ipcRenderer.on(IPC.TranscriptionStatusChanged, listener)
    return () => ipcRenderer.removeListener(IPC.TranscriptionStatusChanged, listener)
  },
  saveExport: (sessionId, displayName, data, format, directory) =>
    ipcRenderer.invoke(IPC.ExportSave, sessionId, displayName, data, format, directory),
  revealExport: (path) => ipcRenderer.invoke(IPC.ExportReveal, path),
  pickAudioFile: () => ipcRenderer.invoke(IPC.PickAudioFile),
  windowMinimize: () => ipcRenderer.invoke(IPC.WindowMinimize),
  windowIsMaximized: () => ipcRenderer.invoke(IPC.WindowIsMaximized),
  windowSetMaximized: (maximized) => ipcRenderer.invoke(IPC.WindowSetMaximized, maximized),
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
