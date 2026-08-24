/** Main ↔ Renderer IPC 通道名（Task 1.3 骨架契约） */
export const IPC = {
  // Renderer → Main（invoke）
  GetSources: 'capture:get-sources',
  PrepareCaptureSource: 'capture:prepare-source',
  ShowDisplaySelectionOutline: 'capture:show-display-selection-outline',
  HideDisplaySelectionOutline: 'capture:hide-display-selection-outline',
  GetPermissions: 'system:get-permissions',
  RequestMicrophoneAccess: 'system:request-microphone-access',
  OpenSystemSettings: 'system:open-settings',
  RecordingStart: 'recording:start',
  RecordingStop: 'recording:stop',
  RecordingWriteChunk: 'recording:write-chunk',
  RecordingWriteMic: 'recording:write-mic',
  RecordingWriteSystemAudio: 'recording:write-system-audio',
  // 录制会话读取（kr-02 预览）
  SessionList: 'session:list',
  SessionLoad: 'session:load',
  SessionReveal: 'session:reveal',
  SessionSaveEdit: 'session:save-edit',
  SessionSaveAudioAsset: 'session:save-audio-asset',
  SessionLoadAudioAsset: 'session:load-audio-asset',
  SessionDeleteAudioAsset: 'session:delete-audio-asset',
  SessionTrash: 'session:trash',
  SessionRestore: 'session:restore',
  SessionDeletePermanent: 'session:delete-permanent',
  SessionEmptyTrash: 'session:empty-trash',
  SessionRemoveMissing: 'session:remove-missing',
  SettingsGet: 'settings:get',
  SettingsUpdate: 'settings:update',
  SettingsChooseRecordingsPath: 'settings:choose-recordings-path',
  SettingsOpenRecordingsPath: 'settings:open-recordings-path',
  UpdateGetState: 'update:get-state',
  UpdateCheck: 'update:check',
  UpdateDownload: 'update:download',
  UpdateInstall: 'update:install',
  UpdateOpenRelease: 'update:open-release',
  // 导出产物保存（kr-03）
  ExportSave: 'export:save',
  // 自定义音轨文件选择（kr-05 custom-audio-track）
  PickAudioFile: 'audio:pick-file',
  // 窗口控制（Windows 自绘标题栏按钮）
  WindowMinimize: 'window:minimize',
  WindowToggleMaximize: 'window:toggle-maximize',
  WindowClose: 'window:close',
  WindowResolveClose: 'window:resolve-close',
  // Main → Renderer（事件推送）
  RecordingError: 'recording:error',
  RecordingStopped: 'recording:stopped',
  InputHookStatus: 'input:hook-status',
  WindowMaximizeChanged: 'window:maximize-changed',
  WindowCloseRequested: 'window:close-requested',
  UpdateStatusChanged: 'update:status-changed'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
