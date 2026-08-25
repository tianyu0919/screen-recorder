import { app } from 'electron'
import { createHash } from 'node:crypto'
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { copyFile, mkdir, open, rename, rm, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { CaptionModelInfo } from '../../shared/captions'
import {
  BUILTIN_CAPTION_MODEL,
  BUILTIN_VAD_MODEL,
  customCaptionModelId,
  parseCaptionModelRegistry,
  sanitizeCaptionModelFileName,
  type CaptionModelRegistry,
  type CustomCaptionModelEntry
} from '../../shared/captionModels'

export interface ResolvedCaptionModel {
  id: string
  name: string
  modelPath: string
  vadModelPath: string
}

const GGML_MAGICS = ['ggml', 'GGUF']
const MIN_MODEL_BYTES = 1024 * 1024
const MAX_MODEL_BYTES = 8 * 1024 * 1024 * 1024

/**
 * 字幕模型管理：内置 Small/VAD 从安装资源（或开发目录）解析，
 * 自定义模型经格式/摘要/helper 探测后原子导入 userData 注册表。
 */
export class CaptionModelManager {
  private registry: CaptionModelRegistry | null = null

  list(): CaptionModelInfo[] {
    const models: CaptionModelInfo[] = [{
      id: BUILTIN_CAPTION_MODEL.id,
      name: BUILTIN_CAPTION_MODEL.name,
      size: BUILTIN_CAPTION_MODEL.size,
      builtin: true
    }]
    for (const entry of this.loadRegistry().models) {
      const path = join(this.customRoot, entry.file)
      if (!existsSync(path) || statSync(path).size !== entry.size) continue
      models.push({ id: entry.id, name: entry.name, size: entry.size, builtin: false })
    }
    return models
  }

  /** 把稳定模型 ID 解析为磁盘路径；内置校验安装资源完整性，自定义校验注册表与文件。 */
  resolve(modelId: string): ResolvedCaptionModel {
    const vadModelPath = this.validatedBuiltinFile(BUILTIN_VAD_MODEL.file, BUILTIN_VAD_MODEL.size)
    if (modelId === BUILTIN_CAPTION_MODEL.id) {
      return {
        id: BUILTIN_CAPTION_MODEL.id,
        name: BUILTIN_CAPTION_MODEL.name,
        modelPath: this.validatedBuiltinFile(BUILTIN_CAPTION_MODEL.file, BUILTIN_CAPTION_MODEL.size),
        vadModelPath
      }
    }
    const entry = this.loadRegistry().models.find((model) => model.id === modelId)
    if (!entry) throw new ModelMissingError('生成该字幕的模型已缺失，请重新导入或选择其他模型')
    const modelPath = join(this.customRoot, entry.file)
    if (!existsSync(modelPath) || statSync(modelPath).size !== entry.size) {
      throw new ModelMissingError(`模型「${entry.name}」的文件已缺失，请重新导入或选择其他模型`)
    }
    return { id: entry.id, name: entry.name, modelPath, vadModelPath }
  }

  /** 导入用户选择的 whisper.cpp 模型：格式与摘要校验 → helper 探测加载 → 原子落盘与注册。 */
  async importModel(
    sourcePath: string,
    probe: (modelPath: string) => Promise<void>
  ): Promise<CaptionModelInfo> {
    if (!sourcePath.toLowerCase().endsWith('.bin')) {
      throw new ModelImportError('仅支持 whisper.cpp 的 ggml .bin 模型文件')
    }
    if (!existsSync(sourcePath)) throw new ModelImportError('所选文件不存在')
    const size = statSync(sourcePath).size
    if (size < MIN_MODEL_BYTES || size > MAX_MODEL_BYTES) {
      throw new ModelImportError('文件大小不符合 whisper.cpp 模型特征')
    }
    const header = Buffer.alloc(4)
    const fd = await open(sourcePath, 'r')
    try { await fd.read(header, 0, 4, 0) } finally { await fd.close() }
    if (!GGML_MAGICS.includes(header.toString('ascii'))) {
      throw new ModelImportError('文件不是合法的 ggml 模型（缺少 ggml/GGUF 头）')
    }
    const sha1 = await sha1File(sourcePath)
    const id = customCaptionModelId(sha1)
    const registry = this.loadRegistry()
    const existing = registry.models.find((model) => model.id === id)
    if (existing && existsSync(join(this.customRoot, existing.file))) {
      return { id: existing.id, name: existing.name, size: existing.size, builtin: false }
    }
    const name = basename(sourcePath, '.bin').trim() || '自定义模型'
    const file = `${id}-${sanitizeCaptionModelFileName(basename(sourcePath))}`
    const target = join(this.customRoot, file)
    const temporary = `${target}.${process.pid}.import`
    await mkdir(this.customRoot, { recursive: true })
    await rm(temporary, { force: true })
    try {
      await copyFile(sourcePath, temporary)
      await probe(temporary)
      await rename(temporary, target)
    } catch (error) {
      await rm(temporary, { force: true }).catch(() => {})
      if (error instanceof ModelImportError) throw error
      throw new ModelImportError(`模型与当前字幕引擎不兼容：${error instanceof Error ? error.message : String(error)}`)
    }
    const entry: CustomCaptionModelEntry = {
      id, name, file, size, sha1, importedAt: new Date().toISOString()
    }
    registry.models = [...registry.models.filter((model) => model.id !== id), entry]
    await this.saveRegistry(registry)
    return { id: entry.id, name: entry.name, size: entry.size, builtin: false }
  }

  /** 删除自定义模型：先更新注册表再删除文件；内置 Small/VAD 不可删除。 */
  async deleteModel(modelId: string): Promise<void> {
    if (modelId === BUILTIN_CAPTION_MODEL.id) throw new ModelImportError('内置模型不可删除')
    const registry = this.loadRegistry()
    const entry = registry.models.find((model) => model.id === modelId)
    if (!entry) throw new ModelMissingError('该模型不在模型库中')
    registry.models = registry.models.filter((model) => model.id !== modelId)
    await this.saveRegistry(registry)
    await rm(join(this.customRoot, entry.file), { force: true }).catch(() => {})
  }

  private validatedBuiltinFile(file: string, size: number): string {
    const path = join(this.builtinRoot, file)
    if (!existsSync(path) || statSync(path).size !== size) {
      throw new ModelMissingError('内置字幕模型缺失或损坏，请重新安装应用')
    }
    return path
  }

  private get builtinRoot(): string {
    return app.isPackaged
      ? join(process.resourcesPath, 'whisper-models')
      : join(app.getAppPath(), 'native/whisper-caption/models')
  }

  private get customRoot(): string { return join(app.getPath('userData'), 'models', 'whisper') }
  private get registryPath(): string { return join(this.customRoot, 'registry.json') }

  private loadRegistry(): CaptionModelRegistry {
    if (this.registry) return this.registry
    let registry: CaptionModelRegistry = { version: 1, models: [] }
    try {
      if (existsSync(this.registryPath)) registry = parseCaptionModelRegistry(JSON.parse(readFileSync(this.registryPath, 'utf8')))
    } catch { registry = { version: 1, models: [] } }
    this.registry = registry
    return registry
  }

  private async saveRegistry(registry: CaptionModelRegistry): Promise<void> {
    await mkdir(this.customRoot, { recursive: true })
    const temporary = `${this.registryPath}.${process.pid}.tmp`
    await writeFile(temporary, JSON.stringify(registry, null, 2), 'utf8')
    await rename(temporary, this.registryPath)
    this.registry = registry
  }
}

async function sha1File(path: string): Promise<string> {
  const hash = createHash('sha1')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

export class ModelMissingError extends Error {
  constructor(message: string) { super(message); this.name = 'ModelMissingError' }
}

export class ModelImportError extends Error {
  constructor(message: string) { super(message); this.name = 'ModelImportError' }
}
