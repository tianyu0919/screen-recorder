/**
 * 录制会话数据契约 —— 与 sdd/specs/screen-recorder/design.md §2 完全一致。
 * kr-02 / kr-03 依赖本文件，改动需同步更新 design.md。
 */

/** events.json 顶层结构，version 用于后续格式演进 */
export interface RecordingEvents {
  version: 1
  /** 录制开始的 Unix 时间戳（ms） */
  startTime: number
  /** 录制时的显示器信息，用于多屏/缩放坐标换算 */
  display: {
    id: number
    /** [x, y, width, height]，屏幕坐标系 */
    bounds: [number, number, number, number]
    scaleFactor: number
  }
  video: {
    width: number
    height: number
    fps: number
    /** 相对会话目录的文件名，如 "screen.webm" */
    file: string
  }
  /** 鼠标轨迹，压缩为 [t, x, y] 三元组数组（量大，可上万条/分钟），60–120Hz 采样 */
  mouseTrack: Array<[number, number, number]>
  clicks: ClickEvent[]
  keys: KeyEvent[]
}

export interface ClickEvent {
  t: number
  x: number
  y: number
  /** 1=左键 2=中键 3=右键 */
  button: 1 | 2 | 3
}

export interface KeyEvent {
  t: number
  /** 归一化后的按键名，如 "Enter"、"A"、"Shift" */
  key: string
}

/** 虚拟相机状态：视口中心点 + 缩放倍率（kr-02 使用，此处仅为契约占位） */
export interface CameraState {
  x: number
  y: number
  zoom: number
}

/** 相机关键帧（kr-02 使用，此处仅为契约占位） */
export interface CameraKeyframe {
  t: number
  target: CameraState
  /** spring 插值参数（阻尼/刚度），默认取全局运镜参数 */
  spring?: { stiffness: number; damping: number }
}

/** 采集器抽象：为原生 helper（方案 B，kr-04）预留的光标开关 */
export interface CaptureOptions {
  sourceId: string
  /** MVP 阶段恒为 true（光标烧录进画面）；原生 helper 落地后可为 false */
  captureCursor: boolean
  audio: { mic: boolean; system: boolean }
}

/** 屏幕/窗口采集源（Main 枚举后传给 Renderer） */
export interface CaptureSource {
  id: string
  name: string
  /** dataURL 缩略图 */
  thumbnail: string
  type: 'screen' | 'window'
}

/** 录制会话元信息（落盘目录 recordings/<session-id>/） */
export interface RecordingSession {
  sessionId: string
  dir: string
  startedAt: number
  /** edit.json 最近一次成功保存时间；从未编辑时不存在。 */
  editedAt?: number
  lifecycle?: 'active' | 'trashed'
  availability?: 'available' | 'storage-unavailable' | 'source-missing'
  trashedAt?: number
  purgeAt?: number
  cleanupFailed?: boolean
}

export type ThemeMode = 'system' | 'light' | 'dark'
export type CloseBehavior = 'background' | 'quit'
export type TrashRetentionDays = 1 | 3 | 7 | 30 | null

export interface AppSettings {
  version: 2
  theme: ThemeMode
  recordingsPath: string
  recordingRoots: string[]
  trashRetentionDays: TrashRetentionDays
  /** null 表示关闭时仍需询问。 */
  closeBehavior: CloseBehavior | null
  /** 启动后延迟检查正式版本更新。 */
  autoCheckUpdates: boolean
}

export interface UpdateCapabilities {
  canDownloadInApp: boolean
  canInstallInApp: boolean
  reason?: 'macos-unsigned'
}

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string; releaseName?: string; releaseNotes?: string; releaseUrl: string }
  | { state: 'not-available'; checkedAt: number }
  | { state: 'downloading'; version: string; percent: number; transferred: number; total: number }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; operation: 'check' | 'download' | 'install'; message: string; version?: string; releaseUrl?: string }

export interface UpdateSnapshot {
  currentVersion: string
  status: UpdateStatus
  capabilities: UpdateCapabilities
  recording: boolean
}

export interface CloseDecision {
  behavior: CloseBehavior
  remember: boolean
}

/** SessionLoad IPC 返回（kr-02 预览加载会话） */
export interface SessionLoadResult {
  session: RecordingSession
  /** events.json 原文：解析与 schema 校验在 Renderer（parseEventsJson）完成，损坏时友好提示 */
  eventsJson: string
  /** 会话级非破坏编辑文档；历史会话不存在时为 null。 */
  editJson: string | null
  /** 自定义 media:// 协议流式 URL，直接喂 <video src>（支持 Range，不整文件读内存） */
  videoUrl: string
  /** mic.wav 流式 URL（麦克风可选轨，不存在时为 null）；预览与画面同步播放 */
  audioUrl: string | null
  /** system.wav 流式 URL（系统音频可选轨，不存在时为 null） */
  systemAudioUrl: string | null
}

/** 导出产物容器格式（kr-03）：mp4 = H.264 主路径，webm = VP9 fallback */
export type ExportFormat = 'mp4' | 'webm'

/** ExportSave IPC 返回（kr-03）：用户取消保存对话框时为 null */
export interface ExportSaveResult {
  path: string
}

/** 权限状态（macOS 引导页用；Windows 上全部视为 granted） */export interface PermissionStatus {
  screen: 'granted' | 'denied' | 'unknown'
  accessibility: 'granted' | 'denied' | 'unknown'
  microphone: 'granted' | 'denied' | 'unknown'
}

/** 录制失败原因（用于 UI 友好提示，不暴露原始堆栈） */
export type RecordingErrorCode =
  | 'PERMISSION_DENIED'
  | 'SOURCE_LOST'
  | 'DISK_FULL'
  | 'INPUT_HOOK_UNAVAILABLE'
  | 'RECORDER_FAILED'
  | 'UNKNOWN'

export interface RecordingError {
  code: RecordingErrorCode
  message: string
}

/** RecordingStart IPC 入参（Renderer 从 MediaStreamTrack.getSettings() 读取视频元信息） */
export interface StartRecordingPayload {
  /** 选中的采集源 id（screen:* 源用于定位被录制的显示器） */
  sourceId: string
  video: { width: number; height: number; fps: number }
}

/** RecordingStart IPC 返回 */
export interface StartRecordingResult {
  sessionId: string
  /** 录制开始 Unix 时间戳（ms），事件时间轴原点 */
  startTime: number
  display: RecordingEvents['display']
  /** false = 输入钩子降级（无点击/键盘事件） */
  inputHookAvailable: boolean
  inputHookError?: string
}

/** events.json 落盘前的 schema 校验，返回错误信息列表（空数组 = 通过） */
export function validateRecordingEvents(data: unknown): string[] {
  const errors: string[] = []
  const d = data as Partial<RecordingEvents> | null
  if (d === null || typeof d !== 'object') return ['events.json 不是对象']
  if (d.version !== 1) errors.push('version 必须为 1')
  if (typeof d.startTime !== 'number') errors.push('startTime 缺失或类型错误')
  const disp = d.display
  if (
    !disp ||
    typeof disp.id !== 'number' ||
    !Array.isArray(disp.bounds) ||
    disp.bounds.length !== 4 ||
    !disp.bounds.every((n) => typeof n === 'number') ||
    typeof disp.scaleFactor !== 'number'
  ) {
    errors.push('display{id,bounds[4],scaleFactor} 缺失或类型错误')
  }
  const v = d.video
  if (
    !v ||
    typeof v.width !== 'number' ||
    typeof v.height !== 'number' ||
    typeof v.fps !== 'number' ||
    typeof v.file !== 'string'
  ) {
    errors.push('video{width,height,fps,file} 缺失或类型错误')
  }
  if (!Array.isArray(d.mouseTrack)) {
    errors.push('mouseTrack 必须是数组')
  } else if (
    !d.mouseTrack.every(
      (p) => Array.isArray(p) && p.length === 3 && p.every((n) => typeof n === 'number')
    )
  ) {
    errors.push('mouseTrack 元素必须是 [t, x, y] 数值三元组')
  }
  if (!Array.isArray(d.clicks)) {
    errors.push('clicks 必须是数组')
  } else if (
    !d.clicks.every(
      (c) =>
        typeof c === 'object' &&
        c !== null &&
        typeof (c as ClickEvent).t === 'number' &&
        typeof (c as ClickEvent).x === 'number' &&
        typeof (c as ClickEvent).y === 'number' &&
        [1, 2, 3].includes((c as ClickEvent).button)
    )
  ) {
    errors.push('clicks 元素必须是 {t,x,y,button:1|2|3}')
  }
  if (!Array.isArray(d.keys)) {
    errors.push('keys 必须是数组')
  } else if (
    !d.keys.every(
      (k) =>
        typeof k === 'object' &&
        k !== null &&
        typeof (k as KeyEvent).t === 'number' &&
        typeof (k as KeyEvent).key === 'string'
    )
  ) {
    errors.push('keys 元素必须是 {t,key:string}')
  }
  return errors
}
