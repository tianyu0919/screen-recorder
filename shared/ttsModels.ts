import manifest from './ttsModels.json'

/**
 * 内置 TTS 音色/模型的唯一事实来源（与 native/tts-helper/fetch-models.mjs 共用同一份 JSON）。
 * 安装包把 bundled 模型目录放在 resourcesPath/tts-models/；
 * 自定义模型由 Main 导入到 userData/models/tts/ 并登记到 registry.json。
 */
export interface TtsModelManifestEntry {
  family: 'vits' | 'kokoro' | 'matcha'
  /** 模型目录名（相对模型根）。 */
  dir: string
  /** 完整模型压缩包（首次获取用）。 */
  archiveUrl: string
  /** 引擎实际加载的模型文件（相对 dir）。 */
  modelFile: string
  voicesFile?: string
  vocoderFile?: string
  requiredFiles: Record<string, { size: number; sha1: string }>
  /** 压缩包内是 LFS 指针、需单独下载补齐的文件。 */
  extraFiles: Record<string, { url: string; size: number; sha1: string }>
  tokens: string
  lexicons?: string[]
  dataDir?: string
  dictDir?: string
  ruleFsts?: string[]
  sampleRate: number
}

export interface TtsVoiceManifestEntry {
  id: string
  name: string
  languages: Array<'zh' | 'en'>
  bundled: boolean
  model: string
  sid: number
}

export const TTS_ENGINE_VERSION: string = manifest.engineVersion
export const TTS_MODEL_MANIFEST = manifest.models as Record<string, TtsModelManifestEntry>
export const TTS_VOICE_MANIFEST = manifest.voices as TtsVoiceManifestEntry[]
export const BUNDLED_TTS_VOICES = TTS_VOICE_MANIFEST.filter((v) => v.bundled)

export function ttsModelSize(entry: TtsModelManifestEntry): number {
  return Object.values(entry.requiredFiles).reduce((total, file) => total + file.size, 0)
}

/** 自定义模型注册表（userData/models/tts/registry.json）中的单条记录。 */
export interface CustomTtsModelEntry {
  id: string
  name: string
  /** 模型目录名（相对 userData/models/tts/），只保留安全字符。 */
  dir: string
  modelFile: string
  size: number
  sha1: string
  /** helper 探测得到的说话人数；一期自定义模型只暴露 sid 0。 */
  numSpeakers: number
  importedAt: string
}

export interface TtsModelRegistry {
  version: 1
  models: CustomTtsModelEntry[]
}

export const EMPTY_TTS_MODEL_REGISTRY: TtsModelRegistry = { version: 1, models: [] }

/** 由模型文件摘要派生稳定 ID：同一模型重复导入得到同一 ID。 */
export function customTtsModelId(sha1: string): string {
  return `custom-${sha1.slice(0, 12)}`
}

/** 注册表落盘目录/文件名只保留安全字符，杜绝路径穿越。 */
export function sanitizeTtsModelName(name: string): string {
  const base = name.replace(/^[A-Za-z]:[\\/]/, '').split(/[\\/]/).pop() ?? ''
  return base.replace(/[^\w.-]/g, '_')
}

/** 解析注册表 JSON；结构非法或条目不完整时丢弃坏条目而不是整体失败。 */
export function parseTtsModelRegistry(value: unknown): TtsModelRegistry {
  if (!value || typeof value !== 'object') return { version: 1, models: [] }
  const models = (value as { models?: unknown }).models
  if (!Array.isArray(models)) return { version: 1, models: [] }
  const entries: CustomTtsModelEntry[] = []
  for (const item of models) {
    if (!item || typeof item !== 'object') continue
    const entry = item as Partial<CustomTtsModelEntry>
    if (typeof entry.id !== 'string' || !entry.id.startsWith('custom-')) continue
    if (typeof entry.name !== 'string' || !entry.name.trim()) continue
    if (typeof entry.dir !== 'string' || entry.dir !== sanitizeTtsModelName(entry.dir)) continue
    if (typeof entry.modelFile !== 'string' || entry.modelFile !== sanitizeTtsModelName(entry.modelFile)) continue
    if (!Number.isFinite(entry.size) || (entry.size ?? 0) <= 0) continue
    if (typeof entry.sha1 !== 'string' || !/^[0-9a-f]{40}$/.test(entry.sha1)) continue
    if (!Number.isInteger(entry.numSpeakers) || (entry.numSpeakers ?? 0) < 1) continue
    if (typeof entry.importedAt !== 'string' || !Number.isFinite(Date.parse(entry.importedAt))) continue
    entries.push(entry as CustomTtsModelEntry)
  }
  return { version: 1, models: entries }
}
