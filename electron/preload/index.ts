import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../../shared/ipc'
import type {
  CaptureSource,
  PermissionStatus,
  RecordingError,
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
