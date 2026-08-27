import { app } from 'electron'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, open, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  TtsGenerateRequest,
  TtsJobStatus,
  TtsLanguage,
  TtsVoiceListItem
} from '../../shared/tts'
import { TTS_ENGINE_VERSION, TTS_PREVIEW_TEXT } from '../../shared/tts'
import { sessionCatalog } from '../store/sessionCatalog'
import { assembleDerivedWav } from './assemble'
import { TtsHelperMissingError } from './helper'
import { probeTtsModel, runTtsSession } from './index'
import {
  ModelImportError,
  ModelMissingError,
  TtsModelManager,
  type ResolvedTtsVoice
} from './modelManager'

/**
 * TTS 配音任务服务（kr-08，仿 transcription/service.ts）：
 * 每会话一个任务；段级缓存 tts-segments/<cacheKey>.wav 命中即跳过，
 * 缺失段走一次 helper 会话合成，失败段按静音处理，全部完成后组装派生轨。
 */

interface ActiveJob {
  request: TtsGenerateRequest
  status: TtsJobStatus
  abort: AbortController
  failedSegmentIds: string[]
}

type StatusListener = (status: TtsJobStatus) => void

export class TtsService {
  private jobs = new Map<string, ActiveJob>()
  private listeners = new Set<StatusListener>()
  private models = new TtsModelManager()

  listVoices(): TtsVoiceListItem[] { return this.models.list() }

  async importModel(sourceDirPath: string): Promise<TtsVoiceListItem[]> {
    await this.models.importModel(sourceDirPath, probeTtsModel)
    return this.listVoices()
  }

  async deleteModel(modelKey: string): Promise<TtsVoiceListItem[]> {
    // 正在用该模型的任务先取消（自定义音色 id = `${modelKey}-0`）
    for (const job of this.jobs.values()) {
      if (job.status.state === 'running' && job.request.voiceId.startsWith(modelKey)) {
        this.cancel(job.request.sessionId)
      }
    }
    await this.models.deleteModel(modelKey)
    return this.listVoices()
  }

  snapshot(sessionId: string): TtsJobStatus {
    const job = this.jobs.get(sessionId)
    // TtsJobState 无 idle 态：无任务会话按 cancelled 零进度快照返回（Renderer 只消费 running 态）
    return job?.status ?? {
      sessionId,
      state: 'cancelled',
      progress: { sessionId, total: 0, done: 0, failed: 0 }
    }
  }

  onStatus(listener: StatusListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async start(request: TtsGenerateRequest): Promise<TtsJobStatus> {
    const existing = this.jobs.get(request.sessionId)
    if (existing && existing.status.state === 'running') return existing.status
    if (request.segments.length === 0) throw new Error('没有可合成的字幕段')
    const dir = sessionCatalog.resolveSessionDir(request.sessionId)
    const resolved = this.models.resolve(request.voiceId)
    // 整轨指纹：段缓存键 + 时间窗 + 音色 + 引擎/模型版本；失配即缓存失效
    const derivedKey = createHash('sha1')
      .update(JSON.stringify(request.segments.map((s) => [s.cacheKey, s.startMs, s.endMs])))
      .update(request.voiceId)
      .update(TTS_ENGINE_VERSION)
      .digest('hex')
    const job: ActiveJob = {
      request,
      status: {
        sessionId: request.sessionId,
        state: 'running',
        progress: { sessionId: request.sessionId, total: request.segments.length, done: 0, failed: 0 }
      },
      abort: new AbortController(),
      failedSegmentIds: []
    }
    this.jobs.set(request.sessionId, job)
    this.emit(job.status)
    void this.run(job, dir, resolved, derivedKey)
    return job.status
  }

  cancel(sessionId: string): TtsJobStatus {
    const job = this.jobs.get(sessionId)
    if (!job || job.status.state !== 'running') return this.snapshot(sessionId)
    job.abort.abort()
    this.update(job, { ...job.status, state: 'cancelled' })
    return this.snapshot(sessionId)
  }

  cancelAll(): void {
    for (const sessionId of this.jobs.keys()) this.cancel(sessionId)
  }

  /** 试听：对固定示例句单次合成到临时文件，读 bytes 返回后即删（不写会话目录）。 */
  async previewVoice(voiceId: string, language: TtsLanguage): Promise<ArrayBuffer> {
    const resolved = this.models.resolve(voiceId)
    const outPath = join(app.getPath('temp'), `lenza-tts-preview-${process.pid}-${Date.now()}.wav`)
    let lastError: string | undefined
    try {
      const session = runTtsSession(
        resolved.model,
        [{ text: TTS_PREVIEW_TEXT[language], sid: resolved.voice.sid, speed: 1.0, outPath }],
        (result) => { if (!result.ok) lastError = result.error },
        new AbortController().signal
      )
      if (!session) throw new TtsHelperMissingError(process.platform)
      const { failed } = await session
      if (failed > 0 || !existsSync(outPath)) throw new Error(lastError ?? '试听合成失败')
      const buffer = await readFile(outPath)
      // 复制为独立 ArrayBuffer（Buffer 底层 slab 可能带偏移，结构化克隆需精确边界）
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    } finally {
      void rm(outPath, { force: true })
    }
  }

  private async run(
    job: ActiveJob,
    dir: string,
    resolved: ResolvedTtsVoice,
    derivedKey: string
  ): Promise<void> {
    try {
      const segmentsDir = join(dir, 'tts-segments')
      await mkdir(segmentsDir, { recursive: true })
      const cached = (cacheKey: string): boolean => existsSync(join(segmentsDir, `${cacheKey}.wav`))
      const missing = job.request.segments.filter((segment) => !cached(segment.cacheKey))
      if (job.abort.signal.aborted) return
      if (missing.length > 0) {
        // outPath → segmentId：helper 回报只带 outPath，需要回填段 id
        const segmentByOut = new Map(missing.map((segment) => [join(segmentsDir, `${segment.cacheKey}.wav`), segment.segmentId]))
        const session = runTtsSession(
          resolved.model,
          missing.map((segment) => ({
            text: segment.text,
            sid: resolved.voice.sid,
            speed: 1.0,
            outPath: join(segmentsDir, `${segment.cacheKey}.wav`)
          })),
          (result) => {
            const segmentId = segmentByOut.get(result.outPath)
            if (!result.ok && segmentId) job.failedSegmentIds.push(segmentId)
            if (job.abort.signal.aborted) return
            const progress = {
              ...job.status.progress,
              done: job.status.progress.done + 1,
              failed: job.status.progress.failed + (result.ok ? 0 : 1),
              currentSegmentId: segmentId
            }
            this.update(job, { ...job.status, progress })
          },
          job.abort.signal
        )
        if (!session) throw new TtsHelperMissingError(process.platform)
        await session
      }
      if (job.abort.signal.aborted) return
      // 等长基准：有 mic.wav 以其实际时长为准（Renderer 只能拿到视频时长，长文件不读全量，只解析头部）
      const micMs = await micDurationMs(dir)
      const expectedDurationMs = micMs ?? job.request.expectedDurationMs
      // 段缓存命中数 = 总段数 - 本次合成数
      const doneTotal = job.request.segments.length
      const assembled = await assembleDerivedWav(
        dir,
        derivedKey,
        job.request.segments,
        expectedDurationMs,
        new Set(job.failedSegmentIds)
      )
      this.update(job, {
        sessionId: job.request.sessionId,
        state: 'completed',
        progress: {
          sessionId: job.request.sessionId,
          total: doneTotal,
          done: doneTotal,
          failed: job.failedSegmentIds.length
        },
        result: {
          derivedFile: assembled.derivedFile,
          derivedKey,
          overflowSegmentIds: assembled.clampedSegmentIds,
          failedSegmentIds: job.failedSegmentIds
        }
      })
    } catch (error) {
      if (job.abort.signal.aborted) return
      this.update(job, { ...job.status, state: 'failed', error: toErrorMessage(error) })
    }
  }

  private update(job: ActiveJob, status: TtsJobStatus): void {
    job.status = status
    this.emit(status)
  }

  private emit(status: TtsJobStatus): void {
    for (const listener of this.listeners) listener(status)
  }
}

/** 仅解析 mic.wav 头部拿时长（RIFF 块扫描，只读前 4KB；失败回退 null）。 */
async function micDurationMs(sessionDir: string): Promise<number | null> {
  const path = join(sessionDir, 'mic.wav')
  if (!existsSync(path)) return null
  let handle: Awaited<ReturnType<typeof open>> | undefined
  try {
    handle = await open(path, 'r')
    const buffer = Buffer.alloc(4096)
    await handle.read(buffer, 0, 4096, 0)
    if (buffer.toString('ascii', 0, 4) !== 'RIFF') return null
    let byteRate = 0
    let dataSize = 0
    let offset = 12
    while (offset + 8 <= buffer.length) {
      const id = buffer.toString('ascii', offset, offset + 4)
      const size = buffer.readUInt32LE(offset + 4)
      if (id === 'fmt ') byteRate = buffer.readUInt32LE(offset + 16)
      if (id === 'data') { dataSize = size; break }
      offset += 8 + size + (size % 2)
    }
    if (!byteRate || !dataSize) return null
    return Math.round((dataSize / byteRate) * 1000)
  } catch { return null } finally { await handle?.close() }
}

function toErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (error instanceof ModelMissingError || error instanceof ModelImportError) return message
  if (error instanceof TtsHelperMissingError) return message
  return `TTS 配音生成失败：${message}`
}

export const ttsService = new TtsService()
