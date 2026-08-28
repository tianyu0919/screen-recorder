import { app } from 'electron'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { cp, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { TtsVoiceInfo, TtsVoiceListItem } from '../../shared/tts'
import {
  TTS_MODEL_MANIFEST,
  TTS_VOICE_MANIFEST,
  customTtsModelId,
  parseTtsModelRegistry,
  sanitizeTtsModelName,
  ttsModelSize,
  type CustomTtsModelEntry,
  type TtsModelManifestEntry,
  type TtsModelRegistry,
  type TtsVoiceManifestEntry
} from '../../shared/ttsModels'
import { sha1File } from './download'

/**
 * TTS 模型/音色管理（kr-08，仿 transcription/modelManager.ts）：
 * 官方音色只从安装资源（或开发目录 native/tts-helper/models）解析；
 * 自定义 VITS 模型经格式/摘要/helper 探测后原子导入 userData/models/tts/ 注册表。
 */

export interface ResolvedTtsModel {
  family: 'vits' | 'kokoro' | 'matcha'
  modelPath: string
  voicesPath?: string
  vocoderPath?: string
  tokensPath: string
  lexiconPaths?: string[]
  dataDirPath?: string
  dictDirPath?: string
  /** 绝对路径列表；helper 侧以逗号分隔传入。 */
  ruleFsts?: string[]
  /** 说话人数：自定义模型取注册表探测值；清单模型为 0（以 helper ready 行为准）。 */
  numSpeakers: number
}

export interface ResolvedTtsVoice {
  voice: TtsVoiceInfo & { modelKey: string }
  model: ResolvedTtsModel
}

export class ModelMissingError extends Error {
  constructor(message: string) { super(message); this.name = 'ModelMissingError' }
}

export class ModelImportError extends Error {
  constructor(message: string) { super(message); this.name = 'ModelImportError' }
}

const CUSTOM_VOICE_RE = /^(custom-[0-9a-f]{12})-(\d+)$/

export class TtsModelManager {
  private registry: TtsModelRegistry | null = null

  list(): TtsVoiceListItem[] {
    const items: TtsVoiceListItem[] = []
    for (const voice of TTS_VOICE_MANIFEST) {
      const entry = TTS_MODEL_MANIFEST[voice.model]
      items.push({
        ...this.voiceInfo(voice, entry ? ttsModelSize(entry) : 0),
        available: entry ? this.manifestModelDir(entry) !== null : false
      })
    }
    for (const entry of this.loadRegistry().models) {
      // 文件缺失/损坏的自定义模型不列出（引导用户重新导入）
      if (!this.customModelValid(entry, false)) continue
      items.push({
        // 一期自定义模型只暴露 sid 0；语言按 sherpa-onnx 多语模型宽口径给出
        id: `${entry.id}-0`,
        name: entry.name,
        languages: ['zh', 'en'],
        bundled: false,
        size: entry.size,
        engine: 'local',
        sid: 0,
        modelKey: entry.id,
        available: true
      })
    }
    return items
  }

  /** 把音色 ID 解析为磁盘模型路径；缺失/损坏抛 ModelMissingError。 */
  resolve(voiceId: string): ResolvedTtsVoice {
    const voice = TTS_VOICE_MANIFEST.find((item) => item.id === voiceId)
    if (voice) return this.resolveManifestVoice(voice)
    const match = CUSTOM_VOICE_RE.exec(voiceId)
    if (match) return this.resolveCustomVoice(match[1], Number(match[2]))
    throw new ModelMissingError('音色不存在，请重新选择')
  }

  /** 导入用户选择的 sherpa-onnx 模型目录：结构校验 → 摘要 → helper 探测 → 原子落盘与注册。 */
  async importModel(
    sourceDirPath: string,
    probe: (model: ResolvedTtsModel) => Promise<{ numSpeakers: number }>
  ): Promise<void> {
    if (!existsSync(sourceDirPath) || !statSync(sourceDirPath).isDirectory()) {
      throw new ModelImportError('请选择 sherpa-onnx TTS 模型目录')
    }
    // 同目录可能同时有 fp32 与量化模型，取最大的一个为引擎加载文件
    const onnxFiles = readdirSync(sourceDirPath)
      .filter((file) => file.toLowerCase().endsWith('.onnx'))
      .map((file) => ({ file, size: statSync(join(sourceDirPath, file)).size }))
      .sort((a, b) => b.size - a.size)
    if (onnxFiles.length === 0) throw new ModelImportError('目录中没有 .onnx 模型文件')
    const modelFile = onnxFiles[0].file
    if (!existsSync(join(sourceDirPath, 'tokens.txt'))) {
      throw new ModelImportError('目录缺少 tokens.txt（sherpa-onnx TTS 模型必需）')
    }
    const modelPath = join(sourceDirPath, modelFile)
    const size = statSync(modelPath).size
    const sha1 = await sha1File(modelPath)
    const id = customTtsModelId(sha1)
    const registry = this.loadRegistry()
    const existing = registry.models.find((model) => model.id === id)
    if (existing && this.customModelValid(existing, false)) return // 同一模型重复导入直接复用

    const target = join(this.customRoot, id)
    const temporary = `${target}.${process.pid}.import`
    await mkdir(this.customRoot, { recursive: true })
    await rm(temporary, { recursive: true, force: true })
    try {
      await cp(sourceDirPath, temporary, { recursive: true })
      // 注册表只登记安全文件名；模型文件名含特殊字符时在副本内改名
      const safeModelFile = sanitizeTtsModelName(modelFile)
      if (safeModelFile !== modelFile) await rename(join(temporary, modelFile), join(temporary, safeModelFile))
      const probeModel: ResolvedTtsModel = {
        family: 'vits',
        modelPath: join(temporary, safeModelFile),
        tokensPath: join(temporary, 'tokens.txt'),
        lexiconPaths: existsSync(join(temporary, 'lexicon.txt')) ? [join(temporary, 'lexicon.txt')] : undefined,
        dictDirPath: existsSync(join(temporary, 'dict')) ? join(temporary, 'dict') : undefined,
        numSpeakers: 0
      }
      const { numSpeakers } = await probe(probeModel)
      await rm(target, { recursive: true, force: true }) // 同 ID 重导入覆盖残留
      await rename(temporary, target)
      const entry: CustomTtsModelEntry = {
        id,
        name: sanitizeTtsModelName(basename(sourceDirPath)).trim() || '自定义模型',
        dir: id,
        modelFile: safeModelFile,
        size,
        sha1,
        numSpeakers,
        importedAt: new Date().toISOString()
      }
      registry.models = [...registry.models.filter((model) => model.id !== id), entry]
      await this.saveRegistry(registry)
    } catch (error) {
      await rm(temporary, { recursive: true, force: true }).catch(() => {})
      if (error instanceof ModelImportError) throw error
      throw new ModelImportError(`模型与当前 TTS 引擎不兼容：${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /** 删除自定义模型：先更新注册表再删目录；清单模型（内置/官方下载）不可删除。 */
  async deleteModel(modelKey: string): Promise<void> {
    if (!modelKey.startsWith('custom-')) throw new ModelImportError('内置/官方模型不可删除')
    const registry = this.loadRegistry()
    const entry = registry.models.find((model) => model.id === modelKey)
    if (!entry) throw new ModelMissingError('该模型不在模型库中')
    registry.models = registry.models.filter((model) => model.id !== modelKey)
    await this.saveRegistry(registry)
    await rm(join(this.customRoot, entry.dir), { recursive: true, force: true }).catch(() => {})
  }

  private voiceInfo(voice: TtsVoiceManifestEntry, size: number): TtsVoiceListItem {
    return {
      id: voice.id,
      name: voice.name,
      languages: voice.languages,
      bundled: voice.bundled,
      size,
      engine: 'local',
      sid: voice.sid,
      modelKey: voice.model,
      available: false
    }
  }

  private resolveManifestVoice(voice: TtsVoiceManifestEntry): ResolvedTtsVoice {
    const entry = TTS_MODEL_MANIFEST[voice.model]
    if (!entry) throw new ModelMissingError('音色模型未登记，请重新选择')
    const dir = this.manifestModelDir(entry)
    if (!dir) {
      throw new ModelMissingError(
        voice.bundled
          ? app.isPackaged
            ? '内置语音模型缺失或损坏，请重新安装应用'
            : '内置语音模型未下载：开发环境请先运行 npm run build:native'
          : `音色「${voice.name}」的模型尚未下载`
      )
    }
    return {
      voice: this.voiceInfo(voice, ttsModelSize(entry)),
      model: {
        family: entry.family,
        modelPath: join(dir, entry.modelFile),
        voicesPath: entry.voicesFile ? join(dir, entry.voicesFile) : undefined,
        vocoderPath: entry.vocoderFile ? join(dir, entry.vocoderFile) : undefined,
        tokensPath: join(dir, entry.tokens),
        lexiconPaths: entry.lexicons?.map((file) => join(dir, file)),
        dataDirPath: entry.dataDir ? join(dir, entry.dataDir) : undefined,
        dictDirPath: entry.dictDir ? join(dir, entry.dictDir) : undefined,
        ruleFsts: entry.ruleFsts?.map((file) => join(dir, file)),
        numSpeakers: 0
      }
    }
  }

  private resolveCustomVoice(customId: string, sid: number): ResolvedTtsVoice {
    if (sid !== 0) throw new ModelMissingError('自定义模型一期仅支持说话人 0')
    const entry = this.loadRegistry().models.find((model) => model.id === customId)
    if (!entry) throw new ModelMissingError('生成该配音的模型已缺失，请重新导入或选择其他音色')
    if (!this.customModelValid(entry, true)) {
      throw new ModelMissingError(`模型「${entry.name}」的文件已缺失或损坏，请重新导入`)
    }
    const dir = join(this.customRoot, entry.dir)
    return {
      voice: {
        id: `${entry.id}-0`,
        name: entry.name,
        languages: ['zh', 'en'],
        bundled: false,
        size: entry.size,
        engine: 'local',
        sid: 0,
        modelKey: entry.id
      },
      model: {
        family: 'vits',
        modelPath: join(dir, entry.modelFile),
        tokensPath: join(dir, 'tokens.txt'),
        lexiconPaths: existsSync(join(dir, 'lexicon.txt')) ? [join(dir, 'lexicon.txt')] : undefined,
        dictDirPath: existsSync(join(dir, 'dict')) ? join(dir, 'dict') : undefined,
        numSpeakers: entry.numSpeakers
      }
    }
  }

  /** 官方模型全部随包内置；运行期不再从 userData 下载根解析。 */
  private manifestModelDir(entry: TtsModelManifestEntry): string | null {
    const dir = join(this.bundledRoot, entry.dir)
    return this.modelFileOk(dir, entry) ? dir : null
  }

  /** 官方模型的全部关键二进制均需存在且大小与清单一致。 */
  private modelFileOk(dir: string, entry: TtsModelManifestEntry): boolean {
    return Object.entries(entry.requiredFiles).every(([file, expected]) => {
      const path = join(dir, file)
      return existsSync(path) && statSync(path).size === expected.size
    }) && existsSync(join(dir, entry.tokens)) &&
      (entry.lexicons ?? []).every((file) => existsSync(join(dir, file))) &&
      (!entry.dataDir || existsSync(join(dir, entry.dataDir)))
  }

  /** 自定义模型文件校验；strict 时额外核对 sha1（resolve 路径用，list 只查大小避免每次全量 hash）。 */
  private customModelValid(entry: CustomTtsModelEntry, strict: boolean): boolean {
    const modelPath = join(this.customRoot, entry.dir, entry.modelFile)
    if (!existsSync(modelPath) || statSync(modelPath).size !== entry.size) return false
    if (!strict) return true
    return createHash('sha1').update(readFileSync(modelPath)).digest('hex') === entry.sha1
  }

  private get bundledRoot(): string {
    return app.isPackaged
      ? join(process.resourcesPath, 'tts-models')
      : join(app.getAppPath(), 'native/tts-helper/models')
  }

  private get customRoot(): string { return join(app.getPath('userData'), 'models', 'tts') }
  private get registryPath(): string { return join(this.customRoot, 'registry.json') }

  private loadRegistry(): TtsModelRegistry {
    if (this.registry) return this.registry
    let registry: TtsModelRegistry = { version: 1, models: [] }
    try {
      if (existsSync(this.registryPath)) registry = parseTtsModelRegistry(JSON.parse(readFileSync(this.registryPath, 'utf8')))
    } catch { registry = { version: 1, models: [] } }
    this.registry = registry
    return registry
  }

  private async saveRegistry(registry: TtsModelRegistry): Promise<void> {
    await mkdir(this.customRoot, { recursive: true })
    const temporary = `${this.registryPath}.${process.pid}.tmp`
    await writeFile(temporary, JSON.stringify(registry, null, 2), 'utf8')
    await rename(temporary, this.registryPath)
    this.registry = registry
  }
}
