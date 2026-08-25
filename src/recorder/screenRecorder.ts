import type { RecordingError, StartRecordingResult } from '@shared/types'
import { createFixedCanvasTrack, type FixedCanvasTrackHandle } from './fixedCanvas'
import { createMainThreadFixedCanvasTrack } from './fixedCanvasMainThread'
import { micBlobToWav } from './wav'
import { windowFrameCornerRadiusPx } from './windowFrameMask'

/** 录制码率（spec: 12–20 Mbps，取 16 Mbps） */
const VIDEO_BITS_PER_SECOND = 16_000_000
const VIDEO_MIME = 'video/webm;codecs=vp9'
const AUDIO_MIME = 'audio/webm;codecs=opus'
const TIMESLICE_MS = 1000

export interface RecorderCallbacks {
  /** 源断开 / 磁盘不足等致命错误（UI 终止录制并提示） */
  onFatalError: (err: RecordingError) => void
}

type RecorderStartResult = StartRecordingResult & { microphoneAvailable: boolean }

/**
 * Renderer 侧录制编排（Task 2.2 / 2.3）：
 * getDisplayMedia 采集画面 → MediaRecorder 高码率 webm 分片 → IPC 写盘；
 * 麦克风单独一条 MediaRecorder，停止时转 WAV 落盘（可选轨）。窗口源仅做
 * 固定画布归一化；运镜、波纹等编辑效果仍在预览/导出期合成。
 */
export class ScreenRecorder {
  private stream: MediaStream | null = null
  private sourceId = ''
  private recorder: MediaRecorder | null = null
  private micStream: MediaStream | null = null
  private micRecorder: MediaRecorder | null = null
  private micChunks: Blob[] = []
  private systemRecorder: MediaRecorder | null = null
  private systemChunks: Blob[] = []
  private fixedCanvas: FixedCanvasTrackHandle | null = null
  private pendingChunkWrites = new Set<Promise<void>>()
  private stopping = false

  constructor(private cb: RecorderCallbacks) {}

  /** 建立屏幕采集流（预览用，开始录制前调用） */
  async acquireStream(sourceId: string): Promise<MediaStream> {
    this.releaseStream()
    this.sourceId = sourceId
    // ScreenCaptureKit 路径：先告知 Main 选中的源，再由 getDisplayMedia 触发 handler approve
    await window.api.prepareCaptureSource(sourceId)
    const stream = await navigator.mediaDevices.getDisplayMedia({
      // 系统音频回采（kr-01 system-audio）：支持的平台自动带 "System audio" 轨，
      // 不支持则静默无音轨；必须关闭语音处理（系统声不是人声，降噪/增益会毁掉它）
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
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

  /** 开始录制：先准备会话与编码器，MediaRecorder 启动后再激活 Main 事件时间轴。 */
  async start(withMic: boolean): Promise<RecorderStartResult> {
    if (!this.stream) throw new Error('尚未建立采集流')
    const track = this.stream.getVideoTracks()[0]
    const settings = track.getSettings()
    const prepared = await window.api.startRecording({
      sourceId: this.sourceId,
      video: {
        width: settings.width ?? 1920,
        height: settings.height ?? 1080,
        fps: Math.round(settings.frameRate ?? 60)
      }
    })

    try {
      // 窗口原始帧等比归一化到冻结画布；整屏录制继续使用原始轨。
      let recordingTrack: MediaStreamTrack = track
      if (prepared.source.type === 'window') {
        try {
          if (!prepared.fixedCanvas) throw new Error('Main 未返回固定画布尺寸')
          const cornerRadiusPx = windowFrameCornerRadiusPx(
            window.api.platform,
            prepared.display.scaleFactor
          )
          try {
            this.fixedCanvas = await createFixedCanvasTrack(
              track,
              prepared.fixedCanvas,
              cornerRadiusPx
            )
          } catch (workerErr) {
            // Chromium 可能不允许 MediaStreamTrack 进入 Worker：降级主线程 canvas 管线
            console.warn(
              '[fixed-canvas] Worker 管线不可用，降级主线程:',
              workerErr instanceof Error ? workerErr.message : workerErr
            )
            this.fixedCanvas = await createMainThreadFixedCanvasTrack(
              track,
              prepared.fixedCanvas,
              cornerRadiusPx
            )
          }
        } catch (error) {
          throw new Error(
            `窗口固定画布不可用: ${error instanceof Error ? error.message : String(error)}`
          )
        }
        recordingTrack = this.fixedCanvas.track
      }

      // 只用 video track 建新流，保持 screen.webm 为纯视频轨。
      const mimeType = MediaRecorder.isTypeSupported(VIDEO_MIME) ? VIDEO_MIME : 'video/webm'
      this.recorder = new MediaRecorder(new MediaStream([recordingTrack]), {
        mimeType,
        videoBitsPerSecond: VIDEO_BITS_PER_SECOND
      })
      this.recorder.ondataavailable = (e) => {
        if (e.data.size === 0) return
        const write = e.data
          .arrayBuffer()
          .then((buf) => window.api.writeChunk(buf))
          .finally(() => this.pendingChunkWrites.delete(write))
        this.pendingChunkWrites.add(write)
      }
      this.recorder.onerror = () => {
        this.cb.onFatalError({ code: 'RECORDER_FAILED', message: '画面编码器异常，录制已停止' })
      }

      // macOS / Windows 均由 Main 原生 helper 采集系统音频；其他平台使用 loopback 兜底。
      const systemTracks =
        window.api.platform === 'darwin' || window.api.platform === 'win32'
          ? []
          : this.stream.getAudioTracks().filter((t) => t.readyState === 'live')
      if (systemTracks.length > 0) {
        try {
          const audioMime = MediaRecorder.isTypeSupported(AUDIO_MIME) ? AUDIO_MIME : 'audio/webm'
          this.systemRecorder = new MediaRecorder(new MediaStream(systemTracks), {
            mimeType: audioMime
          })
          this.systemChunks = []
          this.systemRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) this.systemChunks.push(e.data)
          }
        } catch {
          this.systemRecorder = null
        }
      }

      // 麦克风权限/设备请求也在正式计时前完成，失败只降级本次录制。
      if (withMic) {
        try {
          // 录屏同时存在系统音频回采时，Chromium/macOS 的默认回声消除可能把输入
          // 误判为回声并压成全零。录制素材需要原始稳定输入，显式关闭语音处理。
          this.micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
              channelCount: { ideal: 1 },
              sampleRate: { ideal: 48_000 }
            }
          })
          const audioMime = MediaRecorder.isTypeSupported(AUDIO_MIME) ? AUDIO_MIME : 'audio/webm'
          this.micRecorder = new MediaRecorder(this.micStream, { mimeType: audioMime })
          this.micChunks = []
          this.micRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) this.micChunks.push(e.data)
          }
        } catch {
          this.micStream?.getTracks().forEach((track) => track.stop())
          this.micStream = null
          this.micRecorder = null
        }
      }

      this.stopping = false
      this.recorder.start(TIMESLICE_MS)
      this.systemRecorder?.start(TIMESLICE_MS)
      this.micRecorder?.start(TIMESLICE_MS)
      const activated = await window.api.activateRecording()
      return {
        ...prepared,
        ...activated,
        microphoneAvailable: !withMic || this.micRecorder !== null
      }
    } catch (err) {
      try {
        await this.abort()
      } catch {
        // 保留最初的启动失败原因
      }
      throw err
    }
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
    await this.flushChunkWrites()
    this.disposeFixedCanvas()

    if (this.micRecorder) {
      await this.stopRecorder(this.micRecorder)
      this.micRecorder = null
      const wav = await micBlobToWav(new Blob(this.micChunks, { type: 'audio/webm' }))
      if (wav) await window.api.writeMic(wav)
      this.micChunks = []
    }
    this.micStream?.getTracks().forEach((t) => t.stop())
    this.micStream = null

    if (this.systemRecorder) {
      await this.stopRecorder(this.systemRecorder)
      this.systemRecorder = null
      const wav = await micBlobToWav(new Blob(this.systemChunks, { type: 'audio/webm' }))
      if (wav) await window.api.writeSystemAudio(wav)
      this.systemChunks = []
    }
    // 系统音轨属于采集流，由 releaseStream 统一停

    const result = await window.api.stopRecording()
    this.releaseStream()
    return result
  }

  /** 异常终止：保留已落盘片段（Task 4.2） */
  async abort(): Promise<void> {
    this.stopping = true
    await this.stopRecorder(this.recorder)
    this.recorder = null
    await this.flushChunkWrites()
    this.disposeFixedCanvas()
    if (this.micRecorder) {
      await this.stopRecorder(this.micRecorder)
      this.micRecorder = null
      this.micChunks = []
    }
    this.micStream?.getTracks().forEach((t) => t.stop())
    this.micStream = null
    if (this.systemRecorder) {
      await this.stopRecorder(this.systemRecorder)
      this.systemRecorder = null
      this.systemChunks = []
    }
    await window.api.abortRecording()
    this.releaseStream()
  }

  releaseStream(): void {
    this.disposeFixedCanvas()
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
  }

  private disposeFixedCanvas(): void {
    this.fixedCanvas?.dispose()
    this.fixedCanvas = null
  }

  private stopRecorder(recorder: MediaRecorder | null): Promise<void> {
    return new Promise((resolve) => {
      if (!recorder || recorder.state === 'inactive') return resolve()
      recorder.onstop = () => resolve()
      recorder.stop()
    })
  }

  private async flushChunkWrites(): Promise<void> {
    await Promise.allSettled([...this.pendingChunkWrites])
    this.pendingChunkWrites.clear()
  }
}
