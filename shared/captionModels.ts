import manifest from './captionModels.json'

/**
 * 内置字幕模型的唯一事实来源（与 native/whisper-caption/fetch-models.mjs 共用同一份 JSON）。
 * 安装包把 builtin 主模型 + Silero VAD 放在 resourcesPath/whisper-models/；
 * 自定义模型由 Main 导入到 userData/models/whisper/ 并登记到 registry.json。
 */
export const BUILTIN_CAPTION_MODEL = manifest.builtin
export const BUILTIN_VAD_MODEL = manifest.vad
export const BUILTIN_CAPTION_MODEL_ID: string = manifest.builtin.id

/** 自定义模型注册表（userData/models/whisper/registry.json）中的单条记录。 */
export interface CustomCaptionModelEntry {
  id: string
  name: string
  file: string
  size: number
  sha1: string
  importedAt: string
}

export interface CaptionModelRegistry {
  version: 1
  models: CustomCaptionModelEntry[]
}

export const EMPTY_CAPTION_MODEL_REGISTRY: CaptionModelRegistry = { version: 1, models: [] }

/** 由内容摘要派生稳定模型 ID：同一文件重复导入得到同一 ID。 */
export function customCaptionModelId(sha1: string): string {
  return `custom-${sha1.slice(0, 12)}`
}

/** 注册表落盘文件名只保留安全字符，杜绝路径穿越。 */
export function sanitizeCaptionModelFileName(name: string): string {
  const base = name.replace(/^[A-Za-z]:[\\/]/, '').split(/[\\/]/).pop() ?? ''
  const cleaned = base.replace(/[^\w.-]/g, '_')
  return cleaned.toLowerCase().endsWith('.bin') ? cleaned : `${cleaned}.bin`
}

/** 解析注册表 JSON；结构非法或条目不完整时丢弃坏条目而不是整体失败。 */
export function parseCaptionModelRegistry(value: unknown): CaptionModelRegistry {
  if (!value || typeof value !== 'object') return { ...EMPTY_CAPTION_MODEL_REGISTRY, models: [] }
  const models = (value as { models?: unknown }).models
  if (!Array.isArray(models)) return { version: 1, models: [] }
  const entries: CustomCaptionModelEntry[] = []
  for (const item of models) {
    if (!item || typeof item !== 'object') continue
    const entry = item as Partial<CustomCaptionModelEntry>
    if (typeof entry.id !== 'string' || !entry.id.startsWith('custom-')) continue
    if (typeof entry.name !== 'string' || !entry.name.trim()) continue
    if (typeof entry.file !== 'string' || entry.file !== sanitizeCaptionModelFileName(entry.file)) continue
    if (!Number.isFinite(entry.size) || (entry.size ?? 0) <= 0) continue
    if (typeof entry.sha1 !== 'string' || !/^[0-9a-f]{40}$/.test(entry.sha1)) continue
    if (typeof entry.importedAt !== 'string' || !Number.isFinite(Date.parse(entry.importedAt))) continue
    entries.push(entry as CustomCaptionModelEntry)
  }
  return { version: 1, models: entries }
}
