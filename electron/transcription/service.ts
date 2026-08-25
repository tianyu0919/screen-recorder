import { closeSync, existsSync, openSync, readSync } from 'node:fs'
import { join } from 'node:path'
import type {
  CaptionModelInfo,
  CaptionsDocument,
  StartTranscriptionRequest,
  TranscriptionJobState,
  TranscriptionSnapshot
} from '../../shared/captions'
import { DEFAULT_CAPTION_STYLE } from '../../shared/captions'
import { normalizeCaptionSegments } from '../../shared/captionSegments'
import { loadCaptionsDocument, saveCaptionsDocument } from '../store/captionsStore'
import { sessionCatalog } from '../store/sessionCatalog'
import { CaptionHelperMissingError, type RunningCaptionHelper } from './helper'
import { runCaptionHelper } from './index'
import { CaptionModelManager, ModelChecksumError } from './modelManager'
import { groupCaptionWordsIntoSentences } from '../../shared/transcription'

interface ActiveJob {
  request: StartTranscriptionRequest
  previousDocument: CaptionsDocument | null
  status: TranscriptionJobState
  abort: AbortController
  helper: RunningCaptionHelper | null
}

type StatusListener = (snapshot: TranscriptionSnapshot) => void

export class TranscriptionService {
  private jobs = new Map<string, ActiveJob>()
  private listeners = new Set<StatusListener>()
  private models = new CaptionModelManager()

  listModels(): CaptionModelInfo[] { return this.models.list() }

  snapshot(sessionId: string): TranscriptionSnapshot {
    return { sessionId, status: this.jobs.get(sessionId)?.status ?? { state: 'idle' } }
  }

  onStatus(listener: StatusListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async start(request: StartTranscriptionRequest): Promise<TranscriptionSnapshot> {
    const existing = this.jobs.get(request.sessionId)
    if (existing && ['downloading', 'transcribing'].includes(existing.status.state)) {
      return this.snapshot(request.sessionId)
    }
    const dir = sessionCatalog.resolveSessionDir(request.sessionId)
    const wavPath = join(dir, 'mic.wav')
    if (!existsSync(wavPath)) throw new Error('该会话没有麦克风音轨')
    const previousDocument = loadCaptionsDocument(request.sessionId)
    if (previousDocument && !request.replaceExisting) {
      throw new Error('该会话已有字幕，重新生成前需要确认覆盖')
    }
    const job: ActiveJob = {
      request,
      previousDocument,
      status: { state: 'downloading', progress: 0, model: request.model },
      abort: new AbortController(),
      helper: null
    }
    this.jobs.set(request.sessionId, job)
    this.emit(request.sessionId)
    void this.run(job, wavPath)
    return this.snapshot(request.sessionId)
  }

  cancel(sessionId: string): TranscriptionSnapshot {
    const job = this.jobs.get(sessionId)
    if (!job || !['downloading', 'transcribing'].includes(job.status.state)) return this.snapshot(sessionId)
    job.abort.abort()
    job.helper?.cancel()
    this.update(job, { state: 'cancelled' })
    return this.snapshot(sessionId)
  }

  cancelAll(): void {
    for (const sessionId of this.jobs.keys()) this.cancel(sessionId)
  }

  private async run(job: ActiveJob, wavPath: string): Promise<void> {
    try {
      const vadModelPath = await this.models.ensureVad(job.abort.signal, (progress) => {
        if (!job.abort.signal.aborted) this.update(job, { state: 'downloading', progress: progress * 0.05, model: job.request.model })
      })
      const modelPath = await this.models.ensure(job.request.model, job.abort.signal, (progress) => {
        if (!job.abort.signal.aborted) this.update(job, { state: 'downloading', progress: 0.05 + progress * 0.95, model: job.request.model })
      })
      if (job.abort.signal.aborted) return
      this.update(job, { state: 'transcribing', progress: 0, model: job.request.model })
      const helper = runCaptionHelper(modelPath, vadModelPath, wavPath, job.request.language, (progress) => {
        if (!job.abort.signal.aborted) this.update(job, { state: 'transcribing', progress, model: job.request.model })
      })
      if (!helper) throw new CaptionHelperMissingError(process.platform)
      job.helper = helper
      const result = await helper.result
      if (job.abort.signal.aborted) return
      const durationMs = wavDurationMs(wavPath)
      const document: CaptionsDocument = {
        version: 1,
        source: 'mic',
        language: job.request.language,
        detectedLanguage: result.detectedLanguage,
        style: job.previousDocument?.style ?? {
          ...DEFAULT_CAPTION_STYLE,
          position: { ...DEFAULT_CAPTION_STYLE.position }
        },
        enabled: job.previousDocument?.enabled ?? true,
        segments: normalizeCaptionSegments(groupCaptionWordsIntoSentences(result.segments), durationMs),
        updatedAt: new Date().toISOString()
      }
      const saved = await saveCaptionsDocument(job.request.sessionId, document, durationMs)
      this.update(job, { state: 'done', updatedAt: saved.updatedAt })
    } catch (error) {
      if (job.abort.signal.aborted) return
      this.update(job, toErrorState(error))
    } finally {
      job.helper = null
    }
  }

  private update(job: ActiveJob, status: TranscriptionJobState): void {
    job.status = status
    this.emit(job.request.sessionId)
  }

  private emit(sessionId: string): void {
    const snapshot = this.snapshot(sessionId)
    for (const listener of this.listeners) listener(snapshot)
  }
}

function toErrorState(error: unknown): TranscriptionJobState {
  const message = error instanceof Error ? error.message : String(error)
  if (error instanceof ModelChecksumError) return { state: 'error', code: 'MODEL_CHECKSUM_FAILED', message }
  if (error instanceof CaptionHelperMissingError) return { state: 'error', code: 'HELPER_MISSING', message }
  if (/fetch|HTTP|download|network/i.test(message)) return { state: 'error', code: 'MODEL_DOWNLOAD_FAILED', message: `模型下载失败：${message}` }
  return { state: 'error', code: 'HELPER_FAILED', message: `字幕生成失败：${message}` }
}

function wavDurationMs(path: string): number {
  const fd = openSync(path, 'r')
  const buffer = Buffer.allocUnsafe(64 * 1024)
  let length = 0
  try { length = readSync(fd, buffer, 0, buffer.length, 0) } finally { closeSync(fd) }
  const header = buffer.subarray(0, length)
  if (header.length < 44 || header.toString('ascii', 0, 4) !== 'RIFF') return Infinity
  let offset = 12
  let byteRate = 0
  let dataSize = 0
  while (offset + 8 <= header.length) {
    const id = header.toString('ascii', offset, offset + 4)
    const size = header.readUInt32LE(offset + 4)
    if (id === 'fmt ' && size >= 16) byteRate = header.readUInt32LE(offset + 16)
    if (id === 'data') { dataSize = size; break }
    offset += 8 + size + (size % 2)
  }
  return byteRate > 0 && dataSize > 0 ? dataSize / byteRate * 1000 : Infinity
}

export const transcriptionService = new TranscriptionService()
