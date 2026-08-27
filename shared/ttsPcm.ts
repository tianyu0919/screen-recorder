/**
 * TTS 派生轨 PCM 纯函数（kr-08-tts-dubbing）：
 * WAV 解析/写出、带限重采样、WSOLA 保调变速、等长拼接与边界淡化。
 * 平台无关，Main（electron/tts/assemble）与潜在测试共用；无副作用。
 * 统一输出规格与 mic.wav 一致：48kHz / 2ch / int16。
 */

export const TTS_OUTPUT_SAMPLE_RATE = 48_000
export const TTS_OUTPUT_CHANNELS = 2

export interface Pcm16 {
  sampleRate: number
  channels: number
  /** 16-bit 交错采样（长度 = 帧数 × channels） */
  samples: Int16Array
}

/** 解析 16-bit PCM WAV（遍历 RIFF chunk，不假设固定 44 字节头）；非法输入返回 null */
export function parseWav16(buffer: ArrayBuffer): Pcm16 | null {
  if (buffer.byteLength < 12) return null
  const view = new DataView(buffer)
  if (view.getUint32(0, true) !== 0x46464952 || view.getUint32(8, true) !== 0x45564157) return null
  let sampleRate = 0
  let channels = 0
  let bitsPerSample = 0
  let audioFormat = 0
  let dataOffset = -1
  let dataLength = 0
  let offset = 12
  while (offset + 8 <= buffer.byteLength) {
    const id = view.getUint32(offset, true)
    const size = view.getUint32(offset + 4, true)
    const body = offset + 8
    if (id === 0x20746d66) {
      audioFormat = view.getUint16(body, true)
      channels = view.getUint16(body + 2, true)
      sampleRate = view.getUint32(body + 4, true)
      bitsPerSample = view.getUint16(body + 14, true)
    } else if (id === 0x61746164) {
      dataOffset = body
      dataLength = Math.min(size, buffer.byteLength - body)
    }
    offset = body + size + (size % 2)
  }
  if (audioFormat !== 1 || bitsPerSample !== 16 || channels < 1 || channels > 2 || sampleRate <= 0) return null
  if (dataOffset < 0 || dataLength < 2) return null
  const frameCount = Math.floor(dataLength / (2 * channels))
  return {
    sampleRate,
    channels,
    samples: new Int16Array(buffer, dataOffset, frameCount * channels)
  }
}

/** 写出 16-bit PCM WAV（标准 44 字节头；magic 与 parseWav16 同用小端读取常量） */
export function writeWav16(pcm: Pcm16): ArrayBuffer {
  const dataSize = pcm.samples.length * 2
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)
  view.setUint32(0, 0x46464952, true); view.setUint32(4, 36 + dataSize, true); view.setUint32(8, 0x45564157, true)
  view.setUint32(12, 0x20746d66, true); view.setUint32(16, 16, true)
  view.setUint16(20, 1, true); view.setUint16(22, pcm.channels, true)
  view.setUint32(24, pcm.sampleRate, true)
  view.setUint32(28, pcm.sampleRate * pcm.channels * 2, true)
  view.setUint16(32, pcm.channels * 2, true); view.setUint16(34, 16, true)
  view.setUint32(36, 0x61746164, true); view.setUint32(40, dataSize, true)
  new Int16Array(buffer, 44, pcm.samples.length).set(pcm.samples)
  return buffer
}

/** int16 PCM → mono float32 [-1, 1]（多声道取平均，避免单侧异常）。 */
export function toMonoFloat(pcm: Pcm16): Float32Array {
  const frames = Math.floor(pcm.samples.length / pcm.channels)
  const out = new Float32Array(frames)
  for (let i = 0; i < frames; i++) {
    let sum = 0
    for (let ch = 0; ch < pcm.channels; ch++) sum += pcm.samples[i * pcm.channels + ch]
    out[i] = sum / pcm.channels / 32768
  }
  return out
}

/** Blackman 窗 sinc 带限重采样；离线 TTS 组装优先音质而非逐帧速度。 */
export function resampleBandlimited(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (!Number.isFinite(fromRate) || !Number.isFinite(toRate) || fromRate <= 0 || toRate <= 0) {
    return new Float32Array(0)
  }
  if (fromRate === toRate || input.length === 0) return input.slice()
  const frames = Math.round((input.length / fromRate) * toRate)
  const out = new Float32Array(frames)
  const ratio = toRate / fromRate
  const radius = 20
  const cutoff = 0.94 * Math.min(1, ratio)
  for (let i = 0; i < frames; i++) {
    const center = (i + 0.5) / ratio - 0.5
    const first = Math.ceil(center - radius)
    const last = Math.floor(center + radius)
    let sum = 0
    let weightSum = 0
    for (let source = first; source <= last; source++) {
      if (source < 0 || source >= input.length) continue
      const distance = center - source
      const normalized = Math.abs(distance) / radius
      if (normalized >= 1) continue
      const x = Math.PI * cutoff * distance
      const sinc = x === 0 ? 1 : Math.sin(x) / x
      const window = 0.42 + 0.5 * Math.cos(Math.PI * normalized) +
        0.08 * Math.cos(2 * Math.PI * normalized)
      const weight = cutoff * sinc * window
      sum += input[source] * weight
      weightSum += weight
    }
    out[i] = Math.abs(weightSum) > 1e-8 ? sum / weightSum : 0
  }
  return out
}

function resizeLinearExact(input: Float32Array, targetFrames: number): Float32Array {
  if (targetFrames <= 0 || input.length === 0) return new Float32Array(0)
  if (targetFrames === 1) return new Float32Array([input[0]])
  const out = new Float32Array(targetFrames)
  const step = (input.length - 1) / (targetFrames - 1)
  for (let i = 0; i < targetFrames; i++) {
    const position = i * step
    const left = Math.floor(position)
    const right = Math.min(input.length - 1, left + 1)
    const fraction = position - left
    out[i] = input[left] + (input[right] - input[left]) * fraction
  }
  return out
}

/** 保调变速允许的最大幅度（±20%，spec「时长对齐与溢出处理」） */
export const TTS_RATE_FIT_LIMIT = 0.2

export interface RateFitPlan {
  /** 最终变速倍率（>1 加速缩短，<1 减速拉长；1 = 不变速） */
  rate: number
  /** 超出 ±20% 阈值：按端点速率处理并允许溢出/留静 */
  clamped: boolean
}

/**
 * 计算段变速方案：自然时长 naturalMs 放不进时间窗 windowMs 时保调变速。
 * 策略不对称（按字幕重读的语速真实分布决定）：
 * - 音频过长：+20% 内直接贴合；超阈值钳到端点速率并标记 clamped（溢出段），
 *   保证不与下一段重叠、不被截断；
 * - 音频偏短：保持自然语速（rate=1），剩余窗口留静音——TTS 自然语速普遍快于
 *   人工讲解，减速填空会产生明显拖长/机械感（实测 -20% 减速全线可闻）。
 */
export function planRateFit(naturalMs: number, windowMs: number): RateFitPlan {
  if (naturalMs <= 0 || windowMs <= 0) return { rate: 1, clamped: false }
  const need = naturalMs / windowMs
  if (need <= 1) return { rate: 1, clamped: false }
  if (need > 1 + TTS_RATE_FIT_LIMIT) return { rate: 1 + TTS_RATE_FIT_LIMIT, clamped: true }
  return { rate: need, clamped: false }
}

/**
 * WSOLA 保调变速（单声道 float）：把 input 拉伸/压缩到恰好 targetFrames。
 * 24ms 帧、50% overlap、±12ms 归一化互相关搜索；输入过短退化为精确线性 resize。
 */
export function timeStretchWsola(input: Float32Array, sampleRate: number, targetFrames: number): Float32Array {
  if (input.length === 0 || targetFrames <= 0) return new Float32Array(0)
  if (input.length === targetFrames) return input.slice()
  const frame = Math.round(sampleRate * 0.024)
  if (input.length < frame * 2 || targetFrames < frame) return resizeLinearExact(input, targetFrames)
  const overlap = frame >> 1
  const hop = frame - overlap
  const search = Math.round(sampleRate * 0.012)
  const out = new Float32Array(targetFrames)
  out.set(input.subarray(0, Math.min(frame, targetFrames)))
  let previous = 0
  const inputSpan = Math.max(0, input.length - frame)
  const outputSpan = Math.max(1, targetFrames - frame)
  for (let outStart = hop; outStart < targetFrames; outStart += hop) {
    const nominal = Math.round((outStart / outputSpan) * inputSpan)
    const lo = Math.max(previous, nominal - search, 0)
    const hi = Math.min(inputSpan, nominal + search)
    let best = Math.max(0, Math.min(inputSpan, nominal))
    let bestCorrelation = -Infinity
    for (let candidate = lo; candidate <= hi; candidate += 2) {
      let dot = 0
      let outEnergy = 0
      let inputEnergy = 0
      const count = Math.min(overlap, targetFrames - outStart, input.length - candidate)
      for (let k = 0; k < count; k += 2) {
        const a = out[outStart + k]
        const b = input[candidate + k]
        dot += a * b
        outEnergy += a * a
        inputEnergy += b * b
      }
      const correlation = outEnergy > 1e-8 && inputEnergy > 1e-8
        ? dot / Math.sqrt(outEnergy * inputEnergy)
        : -Math.abs(candidate - nominal)
      if (correlation > bestCorrelation) { bestCorrelation = correlation; best = candidate }
    }
    const count = Math.min(frame, targetFrames - outStart, input.length - best)
    for (let k = 0; k < count; k++) {
      if (k < overlap) {
        const mix = overlap <= 1 ? 1 : k / (overlap - 1)
        out[outStart + k] = out[outStart + k] * (1 - mix) + input[best + k] * mix
      } else out[outStart + k] = input[best + k]
    }
    previous = best
  }
  return out
}

export interface TtsSegmentPlacement {
  /** 段 WAV（引擎原始采样率，单声道 int16） */
  pcm: Pcm16
  startMs: number
  endMs: number
  /** 时间窗外允许溢出的最大毫秒数（被后一段起点硬截断） */
  segmentId: string
}

export interface AssembleResult {
  pcm: Pcm16
  /** 变速超阈值（溢出或被截断）的段 id */
  clampedSegmentIds: string[]
}

/**
 * 把各段合成音频按字幕时间窗拼到等长静音底上（48k/2ch/int16）：
 * 每段 planRateFit → WSOLA 变速 → 带限重采样到 48k → 边界淡化后写入起点；
 * 超出时间窗的部分允许溢出，但被下一段起点截断（不叠加语音）。
 */
export function assembleDerivedTrack(
  segments: TtsSegmentPlacement[],
  totalDurationMs: number
): AssembleResult {
  const totalFrames = Math.max(1, Math.round((totalDurationMs / 1000) * TTS_OUTPUT_SAMPLE_RATE))
  const out = new Int16Array(totalFrames * TTS_OUTPUT_CHANNELS)
  const clampedSegmentIds = new Set<string>()
  const sorted = [...segments].sort((a, b) => a.startMs - b.startMs)
  for (let idx = 0; idx < sorted.length; idx++) {
    const seg = sorted[idx]
    if (seg.pcm.sampleRate <= 0 || seg.pcm.channels <= 0 || seg.pcm.samples.length === 0) continue
    const windowMs = Math.max(1, seg.endMs - seg.startMs)
    const naturalMs = (seg.pcm.samples.length / seg.pcm.channels / seg.pcm.sampleRate) * 1000
    const plan = planRateFit(naturalMs, windowMs)
    if (plan.clamped) clampedSegmentIds.add(seg.segmentId)

    let mono = toMonoFloat(seg.pcm)
    const fittedFrames = Math.max(1, Math.round((naturalMs / plan.rate / 1000) * seg.pcm.sampleRate))
    if (plan.rate !== 1) mono = timeStretchWsola(mono, seg.pcm.sampleRate, fittedFrames)
    const pcm48 = resampleBandlimited(mono, seg.pcm.sampleRate, TTS_OUTPUT_SAMPLE_RATE)

    const rawStart = Math.round((seg.startMs / 1000) * TTS_OUTPUT_SAMPLE_RATE)
    const startFrame = Math.max(0, rawStart)
    const sourceOffset = Math.max(0, -rawStart)
    // 允许溢出，但不越过下一段起点（避免语音叠语音）
    const nextStart = idx + 1 < sorted.length
      ? Math.max(0, Math.round((sorted[idx + 1].startMs / 1000) * TTS_OUTPUT_SAMPLE_RATE))
      : totalFrames
    const naturalEnd = startFrame + Math.max(0, pcm48.length - sourceOffset)
    const endFrame = Math.min(naturalEnd, nextStart, totalFrames)
    if (endFrame < naturalEnd) clampedSegmentIds.add(seg.segmentId)
    const writtenFrames = Math.max(0, endFrame - startFrame)
    const fadeFrames = Math.min(Math.round(TTS_OUTPUT_SAMPLE_RATE * 0.008), Math.floor(writtenFrames / 2))
    for (let f = startFrame; f < endFrame; f++) {
      const local = f - startFrame
      const fadeIn = fadeFrames > 0 ? Math.min(1, local / fadeFrames) : 1
      const fadeOut = fadeFrames > 0 ? Math.min(1, (writtenFrames - 1 - local) / fadeFrames) : 1
      const v = Math.round(pcm48[sourceOffset + local] * Math.min(fadeIn, fadeOut) * 32767)
      const clamped = Math.max(-32768, Math.min(32767, v))
      out[f * 2] = clamped
      out[f * 2 + 1] = clamped
    }
  }
  return {
    pcm: { sampleRate: TTS_OUTPUT_SAMPLE_RATE, channels: TTS_OUTPUT_CHANNELS, samples: out },
    clampedSegmentIds: [...clampedSegmentIds]
  }
}
