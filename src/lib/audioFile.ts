import type { WavData } from '@/export/audio'

export interface DecodedAudioFile {
  wav: WavData
  /** 复用首次解码结果供 Web Audio 预览，避免再次解码原始 FLAC/MP3。 */
  audioBuffer: AudioBuffer
}

/**
 * 自定义音轨解码（kr-05 custom-audio-track）：
 * AudioContext.decodeAudioData 解码任意浏览器支持的音频格式（wav/mp3/m4a/aac/ogg/flac），
 * Float32 多声道 → 16-bit 交错 PCM（与导出混音 WavData 同构）。
 * 仅 Renderer 可用（worker 无 decodeAudioData；导出由 Renderer 解码后 transfer PCM）。
 */

/** 解码音频文件 bytes 为 16-bit PCM；格式不支持/损坏抛错（调用方给友好提示） */
export async function decodeAudioFile(data: ArrayBuffer): Promise<DecodedAudioFile> {
  const ctx = new AudioContext()
  try {
    const buf = await ctx.decodeAudioData(data)
    const channels = Math.min(2, buf.numberOfChannels)
    const frames = buf.length
    const samples = new Int16Array(frames * channels)
    const chans: Float32Array[] = []
    for (let c = 0; c < channels; c++) chans.push(buf.getChannelData(c))
    for (let i = 0; i < frames; i++) {
      for (let c = 0; c < channels; c++) {
        const v = Math.max(-1, Math.min(1, chans[c][i]))
        samples[i * channels + c] = Math.round(v * 32767)
      }
    }
    return {
      wav: { sampleRate: buf.sampleRate, channels, samples },
      audioBuffer: buf
    }
  } finally {
    void ctx.close()
  }
}

/** 波形峰值包络：buckets 桶、每桶取绝对值峰值，0–1 归一化（SVG 绘制用） */
export function computePeaks(wav: WavData, buckets = 200): number[] {
  const frames = Math.floor(wav.samples.length / wav.channels)
  const perBucket = Math.max(1, Math.floor(frames / buckets))
  const peaks: number[] = []
  for (let b = 0; b < buckets; b++) {
    const start = b * perBucket * wav.channels
    const end = Math.min(wav.samples.length, start + perBucket * wav.channels)
    let peak = 0
    for (let i = start; i < end; i++) {
      const v = Math.abs(wav.samples[i])
      if (v > peak) peak = v
    }
    peaks.push(peak / 32768)
  }
  return peaks
}
