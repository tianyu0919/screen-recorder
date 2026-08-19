import type { RecordingError, StartRecordingResult } from '@shared/types'
import { micBlobToWav } from './wav'

/** 录制码率（spec: 12–20 Mbps，取 16 Mbps） */
const VIDEO_BITS_PER_SECOND = 16_000_000
const VIDEO_MIME = 'video/webm;codecs=vp9'
const AUDIO_MIME = 'audio/webm;codecs=opus'
const TIMESLICE_MS = 1000

export interface RecorderCallbacks {
  /** 源断开 / 磁盘不足等致命错误（UI 终止录制并提示） */
  onFatalError: (err: RecordingError) => void
}

/**
 * Renderer 侧录制编排（Task 2.2 / 2.3）：
 * getUserMedia(chromeMediaSourceId) 采集画面 → MediaRecorder 高码率 webm 分片 → IPC 写盘；
 * 麦克风单独一条 MediaRecorder，停止时转 WAV 落盘（可选轨）。
 * 录制期不做任何渲染处理，保证低 CPU 占用。
 */
export class ScreenRecorder {
  private stream: MediaStream | null = null
  private sourceId = ''
  private recorder: MediaRecorder | null = null
  private micStream: MediaStream | null = null
  private micRecorder: MediaRecorder | null = null
  private micChunks: Blob[] = []
  private stopping = false

  constructor(private cb: RecorderCallbacks) {}

  /** 建立屏幕采集流（预览用，开始录制前调用） */
  async acquireStream(sourceId: string): Promise<MediaStream> {
    this.releaseStream()
    this.sourceId = sourceId
    // ScreenCaptureKit 路径：先告知 Main 选中的源，再由 getDisplayMedia 触发 handler approve
    await window.api.prepareCaptureSource(sourceId)
    const stream = await navigator.mediaDevices.getDisplayMedia({
      audio: false,
      video: { frameRate: { ideal: 60 } }
    })
    // 源被关闭（窗口源被关）→ 通知终止录制（Task 4.2）
    stream.getVideoTracks()[0].addEventListener('ended', () => {
      if (this.stopping) return
      this.cb.onFatalError({ code: 'SOURCE_LOST', message: '采集源已断开，录制已停止' })
    })
    this.stream = stream
    return stream
  }

  /** 开始录制：先通知 Main（建立会话 + 启动轨迹轮询/输入钩子），再启动 MediaRecorder */
  async start(withMic: boolean): Promise<StartRecordingResult> {
    if (!this.stream) throw new Error('尚未建立采集流')
    const track = this.stream.getVideoTracks()[0]
    const settings = track.getSettings()
    const result = await window.api.startRecording({
      sourceId: this.sourceId,
      video: {
        width: settings.width ?? 1920,
        height: settings.height ?? 1080,
        fps: Math.round(settings.frameRate ?? 60)
      }
    })

    // 画面录制
    const mimeType = MediaRecorder.isTypeSupported(VIDEO_MIME) ? VIDEO_MIME : 'video/webm'
    this.recorder = new MediaRecorder(this.stream, {
      mimeType,
      videoBitsPerSecond: VIDEO_BITS_PER_SECOND
    })
    this.recorder.ondataavailable = (e) => {
      if (e.data.size === 0) return
      void e.data.arrayBuffer().then((buf) => window.api.writeChunk(buf))
    }
    this.recorder.onerror = () => {
      this.cb.onFatalError({ code: 'RECORDER_FAILED', message: '画面编码器异常，录制已停止' })
    }
    this.recorder.start(TIMESLICE_MS)

    // 麦克风（可选轨；采集失败不阻断录制）
    if (withMic) {
      try {
        this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const audioMime = MediaRecorder.isTypeSupported(AUDIO_MIME) ? AUDIO_MIME : 'audio/webm'
        this.micRecorder = new MediaRecorder(this.micStream, { mimeType: audioMime })
        this.micChunks = []
        this.micRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) this.micChunks.push(e.data)
        }
        this.micRecorder.start(TIMESLICE_MS)
      } catch {
        this.micStream = null
        this.micRecorder = null
      }
    }
    this.stopping = false
    return result
  }

  get hasMic(): boolean {
    return this.micRecorder !== null
  }

  /** 当前是否持有采集流（预览已建立时复用，避免重复弹权限） */
  get hasStream(): boolean {
    return this.stream !== null
  }

  /** 正常停止：flush 分片 → 写 mic.wav → Main 落盘 events.json */
  async stop(): Promise<{ dir: string; sessionId: string } | null> {
    this.stopping = true
    await this.stopRecorder(this.recorder)
    this.recorder = null

    if (this.micRecorder) {
      await this.stopRecorder(this.micRecorder)
      this.micRecorder = null
      const wav = await micBlobToWav(new Blob(this.micChunks, { type: 'audio/webm' }))
      if (wav) await window.api.writeMic(wav)
      this.micChunks = []
    }
    this.micStream?.getTracks().forEach((t) => t.stop())
    this.micStream = null

    const result = await window.api.stopRecording()
    this.releaseStream()
    return result
  }

  /** 异常终止：保留已落盘片段（Task 4.2） */
  async abort(): Promise<void> {
    this.stopping = true
    await this.stopRecorder(this.recorder)
    this.recorder = null
    if (this.micRecorder) {
      await this.stopRecorder(this.micRecorder)
      this.micRecorder = null
      this.micChunks = []
    }
    this.micStream?.getTracks().forEach((t) => t.stop())
    this.micStream = null
    await window.api.abortRecording()
    this.releaseStream()
  }

  releaseStream(): void {
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
  }

  private stopRecorder(recorder: MediaRecorder | null): Promise<void> {
    return new Promise((resolve) => {
      if (!recorder || recorder.state === 'inactive') return resolve()
      recorder.onstop = () => resolve()
      recorder.stop()
    })
  }
}
