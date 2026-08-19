/** Main ↔ Renderer IPC 通道名（Task 1.3 骨架契约） */
export const IPC = {
  // Renderer → Main（invoke）
  GetSources: 'capture:get-sources',
  PrepareCaptureSource: 'capture:prepare-source',
  GetPermissions: 'system:get-permissions',
  OpenSystemSettings: 'system:open-settings',
  RecordingStart: 'recording:start',
  RecordingStop: 'recording:stop',
  RecordingWriteChunk: 'recording:write-chunk',
  RecordingWriteMic: 'recording:write-mic',
  // Main → Renderer（事件推送）
  RecordingError: 'recording:error',
  RecordingStopped: 'recording:stopped',
  InputHookStatus: 'input:hook-status'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
