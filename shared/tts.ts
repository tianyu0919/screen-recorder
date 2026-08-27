/**
 * TTS 配音跨进程契约（kr-08-tts-dubbing）。
 * Main 与 Renderer 只能从这里引用类型与常量，禁止各自重复定义。
 * 一期只实现本地引擎（sherpa-onnx）；`cloud` 为引擎抽象占位，不实现。
 */

export type TtsEngineKind = 'local' | 'cloud'

/** 试听固定示例句（Main 侧单次合成，不写会话目录）。 */
export const TTS_PREVIEW_TEXT: Record<'zh' | 'en', string> = {
  zh: '你好，这是 Lenza 本地语音合成的试听效果。',
  en: 'Hello, this is a preview of Lenza local text to speech.'
}

/** 引擎/模型版本唯一事实来源在 ttsModels.json；这里只做转出口径统一。 */
export { TTS_ENGINE_VERSION } from './ttsModels'

export type TtsLanguage = 'zh' | 'en'

/** 音色 = 模型 + 说话人（同一模型可经不同 sid 派生多个音色）。 */
export interface TtsVoiceInfo {
  /** 稳定音色 ID：内置为 ttsModels.json 里的 id；自定义模型派生为 custom-<sha1 前 12 位>-<sid>。 */
  id: string
  name: string
  languages: TtsLanguage[]
  /** true = 随安装包内置；false = 用户导入。 */
  bundled: boolean
  /** 所属模型主要二进制资源总大小（字节）。 */
  size: number
  engine: TtsEngineKind
  /** sherpa-onnx 说话人 id。 */
  sid: number
}

export interface TtsSegmentRequest {
  /** 字幕段 id，回传进度与结果时对应。 */
  segmentId: string
  text: string
  /** 字幕时间窗（源时间轴 ms），仅用于组装，不参与引擎调用。 */
  startMs: number
  endMs: number
  /** sha1(规范化文本 + voiceId + 引擎/模型版本)；时间窗变化不影响缓存键。 */
  cacheKey: string
}

export interface TtsSegmentResult {
  segmentId: string
  cacheKey: string
  ok: boolean
  /** 会话缓存目录内的段 WAV 相对文件名（tts-segments/ 下）；失败时缺失。 */
  file?: string
  /** 引擎原始采样率（如 MeloTTS 44100），组装期统一重采样到 48k。 */
  sampleRate?: number
  sampleCount?: number
  error?: string
}

export interface TtsJobProgress {
  sessionId: string
  total: number
  done: number
  failed: number
  currentSegmentId?: string
}

export type TtsJobState = 'running' | 'completed' | 'failed' | 'cancelled'

export interface TtsJobStatus {
  sessionId: string
  state: TtsJobState
  progress: TtsJobProgress
  error?: string
  /** 完成时附带的生成结果（TtsJobResult.result 同款；事件推送与终态快照用）。 */
  result?: TtsGenerationResult
}

/** 试听：对固定示例句单次合成，返回临时 WAV 路径，不写会话目录。 */
export interface TtsPreviewRequest {
  voiceId: string
  language: TtsLanguage
}

/** IPC 通道名（在 shared/ipc.ts 注册；此处只放业务负载类型）。 */
export interface TtsGenerateRequest {
  sessionId: string
  voiceId: string
  segments: TtsSegmentRequest[]
  /** 派生轨等长基准：有 mic.wav 为其时长，否则为视频时长（ms）。 */
  expectedDurationMs: number
}

/** 音色列表项：清单音色 + 本机可用性（模型是否已下载/内置资源是否完整）。 */
export interface TtsVoiceListItem extends TtsVoiceInfo {
  /** 所属模型 key（ttsModels.json models 的键或 custom id）。 */
  modelKey: string
  /** 模型文件本机就绪（内置完整 / 已下载 / 已导入）。 */
  available: boolean
}

export interface TtsGenerationResult {
  derivedFile: string
  derivedKey: string
  /** 变速超 ±20% 阈值（溢出/截断）的字幕段 id。 */
  overflowSegmentIds: string[]
  /** 合成失败按静音处理的字幕段 id。 */
  failedSegmentIds: string[]
}

export interface TtsJobResult {
  state: TtsJobState
  progress: TtsJobProgress
  result?: TtsGenerationResult
  error?: string
}
