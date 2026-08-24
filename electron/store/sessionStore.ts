import { createWriteStream, mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { AnyRecordingEvents } from '../../shared/eventsV2'
import type { RecordingSession } from '../../shared/types'
import { validateRecordingEvents } from '../../shared/types'
import { appSettings } from './appSettings'
import { sessionCatalog } from './sessionCatalog'

/**
 * 录制会话落盘（Task 4.1）：
 * 目录结构 recordings/<session-id>/{screen.webm, mic.wav, events.json}
 * 分片流式写盘；写盘失败（如 ENOSPC）时通过 onError 回调上报（Task 4.2）。
 */
export class SessionStore {
  private session: RecordingSession | null = null
  private videoStream: ReturnType<typeof createWriteStream> | null = null
  private failed = false

  constructor(private onError: (code: 'DISK_FULL' | 'UNKNOWN', message: string) => void) {}

  /** 会话根目录：userData/recordings */
  get rootDir(): string {
    return appSettings.get().recordingsPath
  }

  startSession(): RecordingSession {
    const sessionId = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const dir = join(this.rootDir, sessionId)
    try {
      mkdirSync(dir, { recursive: true })
    } catch (err) {
      throw this.toFsError(err)
    }
    this.session = { sessionId, dir, startedAt: Date.now() }
    this.failed = false
    const videoPath = join(dir, 'screen.webm')
    this.videoStream = createWriteStream(videoPath)
    this.videoStream.on('error', (err) => {
      this.failed = true
      const e = this.toFsError(err)
      this.onError(e.code, e.message)
    })
    return this.session
  }

  /** MediaRecorder 分片写盘 */
  writeChunk(chunk: Buffer): void {
    if (!this.videoStream || this.failed) return
    try {
      this.videoStream.write(chunk)
    } catch (err) {
      this.failed = true
      const e = this.toFsError(err)
      this.onError(e.code, e.message)
    }
  }

  /** 麦克风 WAV（停止时一次性写入，可选） */
  writeMic(wav: Buffer): void {
    this.writeWav('mic.wav', wav)
  }

  /** 系统音频 WAV（kr-01 system-audio，停止时一次性写入，可选） */
  writeSystemAudio(wav: Buffer): void {
    this.writeWav('system.wav', wav)
  }

  private writeWav(name: 'mic.wav' | 'system.wav', wav: Buffer): void {
    if (!this.session || this.failed) return
    try {
      writeFileSync(join(this.session.dir, name), wav)
    } catch (err) {
      this.failed = true
      const e = this.toFsError(err)
      this.onError(e.code, e.message)
    }
  }

  /** 关闭视频流 → 校验并写入 events.json（V1/V2）；返回会话目录 */
  async finalize(events: AnyRecordingEvents): Promise<{ dir: string; sessionId: string }> {
    if (!this.session) throw new Error('无进行中的录制会话')
    // 先关流再校验：createWriteStream 异步建文件，必须等 flush 完成后才能确认视频存在
    await this.closeStream()
    const errors = validateRecordingEvents(events)
    if (errors.length > 0) {
      throw new Error(`events.json 校验失败: ${errors.join('; ')}`)
    }
    const videoFile = join(this.session.dir, events.video.file)
    if (!existsSync(videoFile) || statSync(videoFile).size === 0) {
      throw new Error(`视频文件不存在或为空: ${events.video.file}`)
    }
    writeFileSync(join(this.session.dir, 'events.json'), JSON.stringify(events))
    const { dir, sessionId } = this.session
    sessionCatalog.register(sessionId, dir, events.startTime)
    this.session = null
    return { dir, sessionId }
  }

  /** 异常终止：保留已落盘片段，不写 events.json */
  async abort(): Promise<void> {
    await this.closeStream()
    this.session = null
  }

  hasActiveSession(): boolean {
    return this.session !== null
  }

  getSessionDir(): string | null {
    return this.session?.dir ?? null
  }

  private closeStream(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.videoStream) return resolve()
      this.videoStream.end(() => {
        this.videoStream = null
        resolve()
      })
    })
  }

  private toFsError(err: unknown): { code: 'DISK_FULL' | 'UNKNOWN'; message: string } {
    const code = (err as NodeJS.ErrnoException)?.code
    if (code === 'ENOSPC' || code === 'EDQUOT') {
      return { code: 'DISK_FULL', message: '磁盘空间不足，录制已停止，已保留录制片段' }
    }
    return {
      code: 'UNKNOWN',
      message: `写盘失败: ${err instanceof Error ? err.message : String(err)}`
    }
  }
}
