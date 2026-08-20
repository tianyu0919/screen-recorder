import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../../shared/ipc'
import type {
  CaptureSource,
  PermissionStatus,
  RecordingError,
  RecordingSession,
  SessionLoadResult,
  StartRecordingPayload,
  StartRecordingResult
} from '../../shared/types'

export interface RecorderApi {
  getSources(): Promise<CaptureSource[]>
  /** 调 getDisplayMedia 前先告知 Main 选中的源（SCK handler 据此 approve） */
  prepareCaptureSource(sourceId: string): Promise<void>
  getPermissions(): Promise<PermissionStatus>
  openSystemSettings(kind: 'screen' | 'accessibility' | 'microphone'): Promise<void>
  startRecording(payload: StartRecordingPayload): Promise<StartRecordingResult>
  writeChunk(chunk: ArrayBuffer): Promise<void>
  writeMic(wav: ArrayBuffer): Promise<void>
  stopRecording(): Promise<{ dir: string; sessionId: string } | null>
  abortRecording(): Promise<void>
  /** 枚举已落盘的录制会话（kr-02 预览） */
  listSessions(): Promise<RecordingSession[]>
  /** 加载会话：events.json 原文 + media:// 视频流式 URL */
  loadSession(sessionId: string): Promise<SessionLoadResult>
  /** 在系统文件管理器（macOS Finder）中显示会话文件位置 */
  revealSession(sessionId: string): Promise<void>
  onRecordingError(cb: (err: RecordingError) => void): () => void
  onRecordingStopped(cb: (result: { dir: string; sessionId: string }) => void): () => void
}

const api: RecorderApi = {
  getSources: () => ipcRenderer.invoke(IPC.GetSources),
  prepareCaptureSource: (sourceId) => ipcRenderer.invoke(IPC.PrepareCaptureSource, sourceId),
  getPermissions: () => ipcRenderer.invoke(IPC.GetPermissions),
  openSystemSettings: (kind) => ipcRenderer.invoke(IPC.OpenSystemSettings, kind),
  startRecording: (payload) => ipcRenderer.invoke(IPC.RecordingStart, payload),
  writeChunk: (chunk) => ipcRenderer.invoke(IPC.RecordingWriteChunk, chunk),
  writeMic: (wav) => ipcRenderer.invoke(IPC.RecordingWriteMic, wav),
  stopRecording: () => ipcRenderer.invoke(IPC.RecordingStop),
  abortRecording: () => ipcRenderer.invoke('recording:abort'),
  listSessions: () => ipcRenderer.invoke(IPC.SessionList),
  loadSession: (sessionId) => ipcRenderer.invoke(IPC.SessionLoad, sessionId),
  revealSession: (sessionId) => ipcRenderer.invoke(IPC.SessionReveal, sessionId),
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
