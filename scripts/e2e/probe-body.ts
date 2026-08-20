/**
 * e2e 复现：真实 Chromium 里跑"解码 → 合成 → VideoFrame 捕获"链路。
 * 对若干时间点分别取 (a) GL readPixels 哈希（合成器实际画了什么）、
 * (b) new VideoFrame(canvas) → 2d 画布哈希（编码器会看到什么）、
 * (c) gl.getError()（静默 GL 错误探测）、(d) 源帧 VideoFrame.timestamp（游标推进证据）。
 * 画面若冻结，(a)/(b) 哈希将全同。
 */
import { WebmFrameDecoder } from '../../src/export/decoder'
import { Compositor } from '../../src/render/compositor'

/** 抽样 FNV 哈希：判同/不同足够，不必全量 */
export function hashPixels(data: Uint8Array | Uint8ClampedArray): string {
  let h = 0x811c9dc5
  for (let i = 0; i < data.length; i += 613) {
    h ^= data[i]
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}

export interface FrameProbe {
  tSec: number
  srcTsUs?: number
  glError?: number
  glHash?: string
  capHash?: string
  error?: string
}

export async function runContextProbe(videoUrl: string): Promise<{
  durationSec: number
  frames: FrameProbe[]
}> {
  const { decoder, durationSec } = await WebmFrameDecoder.open(videoUrl)
  const canvas = new OffscreenCanvas(1920, 1080)
  const compositor = new Compositor(canvas)
  compositor.setCanvasSize({ width: 3456, height: 2234 })
  // 取同一个 webgl2 上下文做诊断（重复 getContext 返回同一对象）
  const gl = canvas.getContext('webgl2')!
  const frames: FrameProbe[] = []
  try {
    for (const tSec of [0, 3, 10, 30, 60]) {
      const probe: FrameProbe = { tSec }
      try {
        const frame = await decoder.frameAt(tSec)
        if (!frame) {
          probe.error = 'null frame'
          frames.push(probe)
          continue
        }
        probe.srcTsUs = frame.timestamp
        compositor.drawFrame(frame, { x: 1728, y: 1117, zoom: 1 }, tSec * 1000, [])
        probe.glError = gl.getError()
        const px = new Uint8Array(1920 * 1080 * 4)
        gl.readPixels(0, 0, 1920, 1080, gl.RGBA, gl.UNSIGNED_BYTE, px)
        probe.glHash = hashPixels(px)
        // 编码器视角：new VideoFrame(canvas) 捕获到的内容
        const vf = new VideoFrame(canvas, { timestamp: tSec * 1e6 })
        const cap = new OffscreenCanvas(1920, 1080)
        const c2d = cap.getContext('2d')!
        c2d.drawImage(vf, 0, 0)
        probe.capHash = hashPixels(c2d.getImageData(0, 0, 1920, 1080).data)
        vf.close()
      } catch (err) {
        probe.error = err instanceof Error ? err.message : String(err)
      }
      frames.push(probe)
    }
  } finally {
    compositor.dispose()
    decoder.dispose()
  }
  return { durationSec, frames }
}
