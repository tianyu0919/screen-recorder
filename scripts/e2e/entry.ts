/**
 * window 入口：跑 worker 内完整 runExport（与生产同路径），
 * 然后在本页把导出产物（mp4/webm）重新解码，抽样哈希若干时间点帧。
 * 画面冻结 ⇔ 输出文件的不同时间点帧哈希全同。
 */
import { BufferSource, EncodedPacketSink, Input, MP4, WEBM } from 'mediabunny'
import { hashPixels } from './probe-body'
import { parseEventsJson } from '../../src/timeline/types'
import { DEFAULT_MOTION_PARAMS, generateCameraKeyframes } from '../../src/timeline/keyframes'
import { displayToCanvas } from '../../src/timeline/coords'

/** 与 previewStore.derive 完全一致的导出参数派生 */
async function deriveExportParams(sessionId: string) {
  const res = await fetch(`media://rec/${sessionId}/events.json`)
  const timeline = parseEventsJson(await res.text())
  return {
    keyframes: generateCameraKeyframes(timeline.events, timeline.canvas, DEFAULT_MOTION_PARAMS),
    ripples: timeline.events.clicks.map((c) => ({
      t: c.t,
      ...displayToCanvas(timeline.events.display, c.x, c.y)
    })),
    canvas: timeline.canvas,
    fallbackDurationMs: timeline.durationMs
  }
}

declare global {
  interface Window {
    __E2E_VIDEO_URL__?: string
  }
}

interface FullResult {
  buffer: ArrayBuffer
  format: 'mp4' | 'webm'
  audio: boolean
  frames: number
  durationMs: number
}

/** 重新解码导出产物，在目标时间点抽样哈希 */
async function verifyOutput(buffer: ArrayBuffer, format: 'mp4' | 'webm') {
  const input = new Input({
    formats: format === 'mp4' ? [MP4] : [WEBM],
    source: new BufferSource(buffer)
  })
  const track = await input.getPrimaryVideoTrack()
  if (!track) throw new Error('产物没有视频轨')
  const config = await track.getDecoderConfig()
  if (!config) throw new Error('产物无法取到 decoderConfig')
  const durationSec = await input.computeDuration([track])

  // 目标采样点（秒）：0 / 25% / 50% / 75% / 接近末尾
  const targetsSec = [0, 0.25, 0.5, 0.75, 0.98].map((f) => f * durationSec)
  const samples: Array<{ tSec: number; tsUs: number; hash: string }> = []
  const decoder = new VideoDecoder({
    output: (frame) => {
      const tSec = frame.timestamp / 1e6
      const target = targetsSec[samples.length]
      if (target !== undefined && tSec >= target - 0.001) {
        const c = new OffscreenCanvas(320, 180)
        const ctx = c.getContext('2d')!
        ctx.drawImage(frame, 0, 0, 320, 180)
        samples.push({ tSec: target, tsUs: frame.timestamp, hash: hashPixels(ctx.getImageData(0, 0, 320, 180).data) })
      }
      frame.close()
    },
    error: () => {}
  })
  decoder.configure(config)
  const sink = new EncodedPacketSink(track)
  let packetCount = 0
  for await (const packet of sink.packets()) {
    decoder.decode(packet.toEncodedVideoChunk())
    packetCount++
    if (decoder.decodeQueueSize > 16) {
      await new Promise<void>((res) => decoder.addEventListener('dequeue', () => res(), { once: true }))
    }
  }
  await decoder.flush()
  decoder.close()
  const audioTracks = await input.getAudioTracks()
  input.dispose()
  return { durationSec, packetCount, audioTrackCount: audioTracks.length, samples }
}

async function main(): Promise<void> {
  const t0 = Date.now()
  const params = await deriveExportParams('e2e')
  console.log(`[e2e] 派生参数: keyframes=${params.keyframes.length} ripples=${params.ripples.length} canvas=${params.canvas.width}x${params.canvas.height}`)
  const full = await new Promise<FullResult>((resolve, reject) => {
    const w = new Worker('./out/worker.js', { type: 'module' })
    w.onmessage = (e) => {
      const msg = e.data
      if (msg.kind === 'progress') {
        console.log(`[e2e] 导出进度 ${msg.done}/${msg.total}`)
      } else if (msg.kind === 'fatal') {
        reject(new Error(msg.message))
      } else if (msg.kind === 'full') {
        w.terminate()
        resolve(msg.result as FullResult)
      }
    }
    // 与生产一致的导出参数（真实 events.json 派生的 keyframes/ripples）
    w.postMessage({ type: 'full', sessionId: 'e2e', ...params })
  })
  const exportSec = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`[e2e] 导出完成 format=${full.format} audio=${full.audio} frames=${full.frames} 耗时=${exportSec}s`)
  const verify = await verifyOutput(full.buffer, full.format)
  console.log('E2E_RESULT ' + JSON.stringify({ export: { ...full, buffer: undefined, exportSec }, verify }))
}

main().catch((err) => {
  console.log('E2E_RESULT ' + JSON.stringify({ fatal: err instanceof Error ? err.message : String(err) }))
})
