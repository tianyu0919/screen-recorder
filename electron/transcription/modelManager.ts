import { app } from 'electron'
import { createHash } from 'node:crypto'
import { createWriteStream, existsSync, readFileSync, statSync } from 'node:fs'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CaptionModelInfo, CaptionModelTier } from '../../shared/captions'

interface ModelManifestEntry {
  tier: CaptionModelTier
  name: string
  file: string
  size: number
  sha1: string
  url: string
}

const MODEL_ROOT = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main'
const VAD_MODEL: ModelManifestEntry = {
  tier: 'light', name: 'Silero VAD', file: 'ggml-silero-v6.2.0.bin', size: 885_098,
  sha1: '470e5d9d094ddba2f0a512cecc3732a252188abd',
  url: 'https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v6.2.0.bin'
}
const MANIFEST: Record<CaptionModelTier, ModelManifestEntry> = {
  light: {
    tier: 'light', name: 'Whisper Base（轻量）', file: 'ggml-base.bin', size: 147_951_465,
    sha1: '465707469ff3a37a2b9b8d8f89f2f99de7299dac', url: `${MODEL_ROOT}/ggml-base.bin`
  },
  accurate: {
    tier: 'accurate', name: 'Whisper Small（高精度）', file: 'ggml-small.bin', size: 487_601_967,
    sha1: '55356645c2b361a969dfd0ef2c5a50d530afd8d5', url: `${MODEL_ROOT}/ggml-small.bin`
  }
}

export class CaptionModelManager {
  list(): CaptionModelInfo[] {
    return Object.values(MANIFEST).map((model) => ({
      tier: model.tier,
      name: model.name,
      size: model.size + VAD_MODEL.size,
      downloaded: this.isValid(model) && this.isValid(VAD_MODEL)
    }))
  }

  async ensure(
    tier: CaptionModelTier,
    signal: AbortSignal,
    onProgress: (progress: number) => void
  ): Promise<string> {
    return this.ensureModel(MANIFEST[tier], signal, onProgress)
  }

  async ensureVad(signal: AbortSignal, onProgress: (progress: number) => void): Promise<string> {
    return this.ensureModel(VAD_MODEL, signal, onProgress)
  }

  private async ensureModel(
    model: ModelManifestEntry,
    signal: AbortSignal,
    onProgress: (progress: number) => void
  ): Promise<string> {
    const target = this.path(model)
    if (this.isValid(model)) return target
    await mkdir(this.root, { recursive: true })
    const temporary = `${target}.${process.pid}.download`
    await rm(temporary, { force: true })
    try {
      const response = await fetch(model.url, { signal, redirect: 'follow' })
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)
      const total = Number(response.headers.get('content-length')) || model.size
      const file = createWriteStream(temporary, { flags: 'wx' })
      const hash = createHash('sha1')
      const reader = response.body.getReader()
      let received = 0
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          hash.update(value)
          received += value.byteLength
          if (!file.write(value)) await new Promise<void>((resolve) => file.once('drain', resolve))
          onProgress(Math.min(1, received / total))
        }
        await new Promise<void>((resolve, reject) => file.end((error?: Error | null) => error ? reject(error) : resolve()))
      } catch (error) {
        file.destroy()
        throw error
      }
      if (hash.digest('hex') !== model.sha1) throw new ModelChecksumError()
      await rename(temporary, target)
      await writeFile(`${target}.sha1`, model.sha1, 'utf8')
      onProgress(1)
      return target
    } catch (error) {
      await rm(temporary, { force: true }).catch(() => {})
      throw error
    }
  }

  private get root(): string { return join(app.getPath('userData'), 'models', 'whisper') }
  private path(model: ModelManifestEntry): string { return join(this.root, model.file) }

  private isValid(model: ModelManifestEntry): boolean {
    const path = this.path(model)
    if (!existsSync(path) || !existsSync(`${path}.sha1`)) return false
    try {
      return statSync(path).size === model.size &&
        readFileSync(`${path}.sha1`, 'utf8').trim() === model.sha1
    } catch { return false }
  }
}

export class ModelChecksumError extends Error {
  constructor() { super('字幕模型校验失败，请重新下载'); this.name = 'ModelChecksumError' }
}
