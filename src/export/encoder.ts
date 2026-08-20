import {
  BufferTarget,
  EncodedAudioPacketSource,
  EncodedPacket,
  EncodedVideoPacketSource,
  Output,
  WebMOutputFormat
} from 'mediabunny'
import { ArrayBufferTarget, Muxer } from 'mp4-muxer'
import type { ExportFormat } from './messages'

/**
 * 编码探测与封装（Task 1.3 / 2.2 / 2.3）：
 * H.264（mp4-muxer）为主路径，全部探测失败时 fallback VP9 + webm（mediabunny 封装）。
 * 两条路径对 pipeline 暴露同一 ExportMuxer 接口，编码器本体由 pipeline 持有。
 */

export interface VideoEncoderChoice {
  format: ExportFormat
  config: VideoEncoderConfig
}

export const OUTPUT_WIDTH = 1920
export const OUTPUT_HEIGHT = 1080
export const OUTPUT_FPS = 60
const VIDEO_BITRATE = 12_000_000

/** 依次尝试的 H.264 profile（High L5.2 / High L4.2 / Baseline L4.2） */
const H264_CODECS = ['avc1.640034', 'avc1.64002a', 'avc1.42e02a']
/** webm fallback 的 VP9 codec 串 */
const VP9_CODEC = 'vp09.00.10.08'

/** 探测可用的视频编码配置；H.264 全部不可用 → VP9+webm；再不可用 → 抛错 */
export async function probeVideoEncoder(): Promise<VideoEncoderChoice> {
  for (const codec of H264_CODECS) {
    const config: VideoEncoderConfig = {
      codec,
      width: OUTPUT_WIDTH,
      height: OUTPUT_HEIGHT,
      bitrate: VIDEO_BITRATE,
      framerate: OUTPUT_FPS,
      latencyMode: 'quality'
    }
    const support = await VideoEncoder.isConfigSupported(config)
    if (support.supported) return { format: 'mp4', config }
  }
  const config: VideoEncoderConfig = {
    codec: VP9_CODEC,
    width: OUTPUT_WIDTH,
    height: OUTPUT_HEIGHT,
    bitrate: VIDEO_BITRATE,
    framerate: OUTPUT_FPS,
    latencyMode: 'quality'
  }
  const support = await VideoEncoder.isConfigSupported(config)
  if (support.supported) return { format: 'webm', config }
  throw new Error('当前环境无可用视频编码器（H.264 / VP9 均不支持）')
}

/** 对 pipeline 统一的封装接口：两种容器路径共用 */
export interface ExportMuxer {
  addVideoChunk(chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata): Promise<void>
  addAudioChunk(chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata): Promise<void>
  finalize(): Promise<ArrayBuffer>
}

/** 音轨声明（null = 无音轨）；sampleRate/声道数取自 mic.wav 真实参数 */
export interface AudioTrackInfo {
  sampleRate: number
  numberOfChannels: number
}

/** 按探测结果创建封装器；audio 为 null 则不声明音轨 */
export function createMuxer(choice: VideoEncoderChoice, audio: AudioTrackInfo | null): ExportMuxer {
  return choice.format === 'mp4' ? createMp4Muxer(audio) : createWebmMuxer(audio)
}

function createMp4Muxer(audio: AudioTrackInfo | null): ExportMuxer {
  const target = new ArrayBufferTarget()
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT },
    ...(audio ? { audio: { codec: 'aac', ...audio } } : {}),
    fastStart: 'in-memory'
  })
  return {
    async addVideoChunk(chunk, meta) {
      muxer.addVideoChunk(chunk, meta)
    },
    async addAudioChunk(chunk, meta) {
      muxer.addAudioChunk(chunk, meta)
    },
    async finalize() {
      muxer.finalize()
      return target.buffer
    }
  }
}

function createWebmMuxer(audio: AudioTrackInfo | null): ExportMuxer {
  const target = new BufferTarget()
  const output = new Output({ format: new WebMOutputFormat(), target })
  const videoSource = new EncodedVideoPacketSource('vp9')
  output.addVideoTrack(videoSource)
  // 注意：WebM 容器不支持 AAC；webm fallback 下音轨走 opus（见 audio.ts 探测）
  const audioSource = audio ? new EncodedAudioPacketSource('opus') : null
  if (audioSource) output.addAudioTrack(audioSource)
  let startPromise: Promise<void> | null = null
  const ensureStarted = (): Promise<void> => {
    startPromise ??= output.start()
    return startPromise
  }
  return {
    async addVideoChunk(chunk, meta) {
      await ensureStarted()
      await videoSource.add(EncodedPacket.fromEncodedChunk(chunk), meta)
    },
    async addAudioChunk(chunk, meta) {
      if (!audioSource) return
      await ensureStarted()
      await audioSource.add(EncodedPacket.fromEncodedChunk(chunk), meta)
    },
    async finalize() {
      await ensureStarted()
      await output.finalize()
      if (!target.buffer) throw new Error('webm 封装失败：无输出数据')
      return target.buffer
    }
  }
}
