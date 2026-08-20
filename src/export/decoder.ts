import { EncodedPacket, EncodedPacketSink, Input, UrlSource, WEBM } from 'mediabunny'

/**
 * 源视频顺序解码取帧（Task 1.2）：
 * mediabunny 按 decode order 迭代 webm packet → WebCodecs VideoDecoder 顺序解码，
 * 维护"当前帧"游标：导出时间轴推进时，把后继时间戳仍 <= t 的队首帧丢弃。
 * 不做随机 seek —— 导出时间轴单调递增，顺序解码天然够用。
 */

/** 导出失败的用户可见原因（pipeline 统一兜底为友好提示） */
export class ExportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExportError'
  }
}

/**
 * 时间戳匹配容差（µs）：源帧时间戳经 µs 取整可能与 1/60 时间轴错开零点几毫秒，
 * 1ms 容差远小于半帧（~8.3ms），不会误跳帧。
 */
const TIMESTAMP_EPS_US = 1000
/** 解码器输入队列上限（背压：超过则等输出/出队事件） */
const MAX_DECODE_QUEUE = 8

export interface FrameCursorDecision {
  /** 应丢弃的队首帧数（这些帧已有不晚于 t 的后继帧，过期） */
  drop: number
  status: 'ready' | 'need-more' | 'exhausted'
}

/**
 * 取帧游标推进决策（纯函数，node 可测）：
 * - 连续丢弃"后继帧时间戳仍 <= t"的队首帧；
 * - 剩余 ≥2 帧时队首即"不晚于 t 的最近帧"（后继晚于 t）；
 * - 仅剩 1 帧时需确认没有更晚但仍 <= t 的帧：解码未耗尽则继续拉取。
 */
export function frameCursorDecision(
  queue: readonly { timestamp: number }[],
  tUs: number,
  ended: boolean
): FrameCursorDecision {
  let drop = 0
  while (drop + 1 < queue.length && queue[drop + 1].timestamp <= tUs + TIMESTAMP_EPS_US) drop++
  const remaining = queue.length - drop
  if (remaining === 0) return { drop, status: ended ? 'exhausted' : 'need-more' }
  if (remaining >= 2) return { drop, status: 'ready' }
  return { drop, status: ended ? 'ready' : 'need-more' }
}

export class WebmFrameDecoder {
  private input: Input
  private decoder: VideoDecoder
  private packets: AsyncGenerator<EncodedPacket, void, unknown>
  /** 解码输出队列（呈现序），队首即当前游标帧；帧所有权归本类，调用方不得 close */
  private queue: VideoFrame[] = []
  private exhausted = false
  private decodeError: unknown = null
  private waiters: Array<{ resolve: () => void; reject: (err: unknown) => void }> = []

  private constructor(
    input: Input,
    packets: AsyncGenerator<EncodedPacket, void, unknown>,
    config: VideoDecoderConfig
  ) {
    this.input = input
    this.packets = packets
    this.decoder = new VideoDecoder({
      output: (frame) => {
        this.queue.push(frame)
        this.notify()
      },
      error: (err) => {
        this.decodeError = err
        this.notify()
      }
    })
    // 出队事件用于背压唤醒（喂入太满时挂起等消化）
    this.decoder.addEventListener('dequeue', () => this.notify())
    this.decoder.configure(config)
  }

  /** 打开源 webm 并初始化解码器；demux/解码配置失败抛 ExportError('源视频无法解码') */
  static async open(videoUrl: string): Promise<{ decoder: WebmFrameDecoder; durationSec: number }> {
    const input = new Input({ formats: [WEBM], source: new UrlSource(videoUrl) })
    try {
      const track = await input.getPrimaryVideoTrack()
      if (!track) throw new ExportError('源视频无法解码: 没有视频轨')
      const config = await track.getDecoderConfig()
      if (!config || !(await VideoDecoder.isConfigSupported(config)).supported) {
        throw new ExportError('源视频无法解码: 编码格式不支持')
      }
      // MediaRecorder 产出的 webm 缺 Duration 元数据，必须 computeDuration 拿真实时长
      const durationSec = await input.computeDuration([track])
      const sink = new EncodedPacketSink(track)
      const packets = sink.packets()
      return { decoder: new WebmFrameDecoder(input, packets, config), durationSec }
    } catch (err) {
      input.dispose()
      if (err instanceof ExportError) throw err
      throw new ExportError(`源视频无法解码: ${errMsg(err)}`)
    }
  }

  /**
   * 取 tSec 时刻的源帧：返回不晚于 t 的最近帧（游标语义见 frameCursorDecision）。
   * 返回的帧由本类持有（下次推进游标时 close），调用方用完不得 close。
   * 源完全耗尽且队列为空时返回 null（仅当源没有任何帧）。
   */
  async frameAt(tSec: number): Promise<VideoFrame | null> {
    const tUs = tSec * 1e6
    for (;;) {
      this.throwIfError()
      const { drop, status } = frameCursorDecision(this.queue, tUs, this.exhausted)
      for (let i = 0; i < drop; i++) this.queue.shift()!.close()
      if (status === 'ready') return this.queue[0]
      if (status === 'exhausted') return null
      // need-more：喂入未超背压上限就拉下一个 packet，否则挂起等解码输出/出队
      if (!this.exhausted && this.decoder.decodeQueueSize < MAX_DECODE_QUEUE) {
        await this.feedOne()
      } else {
        await this.wait()
      }
    }
  }

  /** 拉取下一个 packet 喂入解码器；packet 流耗尽则 flush 并标记 exhausted */
  private async feedOne(): Promise<void> {
    const { value, done } = await this.packets.next()
    if (done) {
      // flush 完成后解码器交付剩余全部帧，之后才视为耗尽
      if (this.decoder.state === 'configured') {
        try {
          await this.decoder.flush()
        } catch {
          /* 解码错误已由 error 回调记录 */
        }
      }
      this.exhausted = true
      this.notify()
      return
    }
    this.decoder.decode(value.toEncodedVideoChunk())
  }

  private wait(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.waiters.push({ resolve, reject })
    })
  }

  private notify(): void {
    const waiters = this.waiters.splice(0)
    for (const w of waiters) {
      if (this.decodeError) w.reject(this.decodeError)
      else w.resolve()
    }
  }

  private throwIfError(): void {
    if (this.decodeError) {
      throw new ExportError(`源视频无法解码: ${errMsg(this.decodeError)}`)
    }
  }

  dispose(): void {
    for (const frame of this.queue) frame.close()
    this.queue = []
    if (this.decoder.state !== 'closed') this.decoder.close()
    this.input.dispose()
    this.decodeError ??= new ExportError('导出已取消')
    this.notify()
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
