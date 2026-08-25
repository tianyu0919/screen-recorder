export const CAPTION_LANGUAGES = ['auto', 'zh', 'en'] as const
export type CaptionLanguage = (typeof CAPTION_LANGUAGES)[number]

export interface CaptionPosition {
  x: number
  y: number
}

export interface CaptionStyle {
  fontPreset: 'sans' | 'rounded' | 'serif'
  fontSize: number
  textColor: string
  strokeColor: string
  strokeWidth: number
  backgroundColor: string
  backgroundOpacity: number
  cornerRadius: number
  align: 'left' | 'center' | 'right'
  maxWidthRatio: number
  position: CaptionPosition
  fadeMs: number
}

export interface CaptionSegment {
  id: string
  startMs: number
  endMs: number
  text: string
  positionOverride?: CaptionPosition
}

export interface CaptionsDocument {
  version: 1
  source: 'mic' | 'srt'
  language: CaptionLanguage
  detectedLanguage?: string
  /** 生成字幕所用模型的稳定 ID 与显示名；历史文档可缺失（按内置 Small 回显）。 */
  transcriptionModel?: { id: string; name: string }
  style: CaptionStyle
  /** 会话级字幕总开关。 */
  enabled: boolean
  segments: CaptionSegment[]
  updatedAt: string
}

export interface CaptionModelInfo {
  /** 稳定模型 ID：内置为 captionModels.json 里的 id，自定义为 custom-<sha1 前 12 位>。 */
  id: string
  name: string
  size: number
  builtin: boolean
}

export type TranscriptionJobState =
  | { state: 'idle' }
  | { state: 'transcribing'; progress: number; model: string }
  | { state: 'done'; updatedAt: number }
  | { state: 'cancelled' }
  | { state: 'error'; code: TranscriptionErrorCode; message: string }

export type TranscriptionErrorCode =
  | 'NO_MIC'
  | 'MODEL_MISSING'
  | 'HELPER_MISSING'
  | 'HELPER_FAILED'
  | 'INVALID_OUTPUT'
  | 'CANCELLED'
  | 'UNKNOWN'

export interface StartTranscriptionRequest {
  sessionId: string
  language: CaptionLanguage
  /** 稳定模型 ID（内置或注册表中的自定义模型）；Renderer 不传递文件路径。 */
  modelId: string
  replaceExisting: boolean
}

export interface TranscriptionSnapshot {
  sessionId: string
  status: TranscriptionJobState
}

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontPreset: 'sans',
  fontSize: 42,
  textColor: '#FFFFFF',
  strokeColor: '#000000',
  strokeWidth: 2,
  backgroundColor: '#000000',
  backgroundOpacity: 0.62,
  cornerRadius: 12,
  align: 'center',
  maxWidthRatio: 0.76,
  position: { x: 0.5, y: 0.84 },
  fadeMs: 120
}

const HEX_COLOR = /^#[0-9A-F]{6}$/i

export function validateCaptionsDocument(value: unknown, durationMs = Infinity): string[] {
  const errors: string[] = []
  if (!value || typeof value !== 'object') return ['captions.json 不是对象']
  const document = value as Partial<CaptionsDocument>
  if (document.version !== 1) errors.push('version 必须为 1')
  if (document.source !== 'mic' && document.source !== 'srt') errors.push('source 无效')
  if (!CAPTION_LANGUAGES.includes(document.language as CaptionLanguage)) errors.push('language 无效')
  if (!document.style || typeof document.style !== 'object') errors.push('style 缺失')
  else errors.push(...validateCaptionStyle(document.style))
  if (document.transcriptionModel !== undefined) {
    const model = document.transcriptionModel
    if (!model || typeof model !== 'object' || typeof model.id !== 'string' || !model.id ||
      typeof model.name !== 'string' || !model.name.trim()) {
      errors.push('transcriptionModel 无效')
    }
  }
  if (typeof document.enabled !== 'boolean') errors.push('enabled 无效')
  if (!Array.isArray(document.segments)) errors.push('segments 必须是数组')
  else {
    let previousEnd = 0
    for (const [index, segment] of document.segments.entries()) {
      if (!segment || typeof segment !== 'object') {
        errors.push(`segments[${index}] 无效`)
        continue
      }
      if (typeof segment.id !== 'string' || !segment.id) errors.push(`segments[${index}].id 无效`)
      if (typeof segment.text !== 'string' || !segment.text.trim()) errors.push(`segments[${index}].text 为空`)
      if (!Number.isFinite(segment.startMs) || !Number.isFinite(segment.endMs)) {
        errors.push(`segments[${index}] 时间无效`)
      } else if (segment.startMs < 0 || segment.endMs <= segment.startMs || segment.endMs > durationMs) {
        errors.push(`segments[${index}] 超出音视频范围`)
      } else if (segment.startMs < previousEnd) {
        errors.push(`segments[${index}] 与前一段重叠或未排序`)
      }
      previousEnd = Number.isFinite(segment.endMs) ? segment.endMs : previousEnd
      if (segment.positionOverride) errors.push(...validatePosition(segment.positionOverride, `segments[${index}].positionOverride`))
    }
  }
  if (typeof document.updatedAt !== 'string' || !Number.isFinite(Date.parse(document.updatedAt))) {
    errors.push('updatedAt 无效')
  }
  return errors
}

/** V1 兼容：旧版 burnEnabled 是当时唯一的字幕开关。 */
export function migrateCaptionsDocument(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value
  const legacy = value as Record<string, unknown>
  if (typeof legacy.enabled === 'boolean') return value
  return {
    ...legacy,
    enabled: typeof legacy.burnEnabled === 'boolean' ? legacy.burnEnabled : true
  }
}

function validateCaptionStyle(style: Partial<CaptionStyle>): string[] {
  const errors: string[] = []
  if (!['sans', 'rounded', 'serif'].includes(style.fontPreset ?? '')) errors.push('style.fontPreset 无效')
  if (!Number.isFinite(style.fontSize) || style.fontSize! < 12 || style.fontSize! > 160) errors.push('style.fontSize 无效')
  for (const key of ['textColor', 'strokeColor', 'backgroundColor'] as const) {
    if (typeof style[key] !== 'string' || !HEX_COLOR.test(style[key]!)) errors.push(`style.${key} 无效`)
  }
  if (!Number.isFinite(style.strokeWidth) || style.strokeWidth! < 0 || style.strokeWidth! > 12) errors.push('style.strokeWidth 无效')
  if (!Number.isFinite(style.backgroundOpacity) || style.backgroundOpacity! < 0 || style.backgroundOpacity! > 1) errors.push('style.backgroundOpacity 无效')
  if (!Number.isFinite(style.cornerRadius) || style.cornerRadius! < 0 || style.cornerRadius! > 48) errors.push('style.cornerRadius 无效')
  if (!['left', 'center', 'right'].includes(style.align ?? '')) errors.push('style.align 无效')
  if (!Number.isFinite(style.maxWidthRatio) || style.maxWidthRatio! < 0.2 || style.maxWidthRatio! > 0.95) errors.push('style.maxWidthRatio 无效')
  if (!Number.isFinite(style.fadeMs) || style.fadeMs! < 0 || style.fadeMs! > 1000) errors.push('style.fadeMs 无效')
  if (style.position) errors.push(...validatePosition(style.position, 'style.position'))
  else errors.push('style.position 缺失')
  return errors
}

function validatePosition(position: CaptionPosition, label: string): string[] {
  return Number.isFinite(position.x) && Number.isFinite(position.y) &&
    position.x >= 0 && position.x <= 1 && position.y >= 0 && position.y <= 1
    ? [] : [`${label} 无效`]
}
