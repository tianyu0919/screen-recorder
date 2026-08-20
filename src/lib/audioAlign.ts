/**
 * 双轨自动对齐（系统音回声修复）：
 * 音箱外放时麦克风轨会 acoustically 录入系统音，与 system.wav 混合形成回声；
 * 两条采集链路的固定延迟差（声卡/Voicemeeter 引擎缓冲等）逐机不同，无法在采集侧补偿，
 * 故在导出/预览混音前用降采样互相关估计 system 相对 mic 的恒定偏移。
 * 归一化相关度不足（耳机用户 mic 轨里没有系统音）→ 返回 0 不对齐，不产生副作用。
 */

/** 可估计偏移的音轨（与 export/audio.ts WavData 结构兼容） */
export interface AlignableTrack {
  sampleRate: number
  channels: number
  /** 16-bit PCM 交错采样 */
  samples: Int16Array
}

/** 降采样目标采样率（4kHz 足够做语音/音乐互相关，且计算量小） */
const TARGET_RATE = 4000
/** 搜索范围 ±500ms（采集链延迟差实测量级 ~200ms，留余量） */
const MAX_OFFSET_S = 0.5
/** 归一化互相关阈值：低于此认为两轨无共同内容（耳机用户），不对齐 */
const MIN_CORR = 0.25
/** 每个估计窗口长度（秒） */
const WINDOW_S = 1.0
/** 短于此时长（秒）不估计（样本太少不可靠） */
const MIN_DURATION_S = 8

/**
 * 估计 system 相对 mic 的恒定偏移（秒）。
 * 正值 = system 内容在文件中偏晚（混音时应把 system 提前该偏移量）。
 */
export function estimateSystemOffsetSec(mic: AlignableTrack, sys: AlignableTrack): number {
  const micDur = mic.samples.length / mic.channels / mic.sampleRate
  const sysDur = sys.samples.length / sys.channels / sys.sampleRate
  const duration = Math.min(micDur, sysDur)
  if (duration < MIN_DURATION_S) return 0

  const micDs = downsampleToMono(mic)
  const sysDs = downsampleToMono(sys)
  const dsRate = TARGET_RATE

  // 3 个窗口（避开首尾：system 头部可能有 pre-roll 静音，尾部各轨停止时间不同）
  const offsets: number[] = []
  for (const at of [0.25, 0.5, 0.7]) {
    const startS = Math.max(2, duration * at)
    if (startS + WINDOW_S + MAX_OFFSET_S > duration) continue
    const result = correlateAt(micDs, sysDs, dsRate, startS)
    if (result && result.corr >= MIN_CORR) offsets.push(result.lagS)
  }
  // 至少 2 个窗口达成一致（偏差 < 20ms）才采信，防误对齐
  if (offsets.length < 2) return 0
  offsets.sort((a, b) => a - b)
  const median = offsets[Math.floor(offsets.length / 2)]
  const agree = offsets.filter((o) => Math.abs(o - median) < 0.02).length
  return agree >= 2 ? median : 0
}

/** 单声道化 + 整数倍降采样到 ~4kHz */
function downsampleToMono(track: AlignableTrack): Float32Array {
  const factor = Math.max(1, Math.round(track.sampleRate / TARGET_RATE))
  const { samples, channels } = track
  const frames = Math.floor(samples.length / channels)
  const outLen = Math.floor(frames / factor)
  const out = new Float32Array(outLen)
  for (let i = 0; i < outLen; i++) {
    // 每 factor 帧取块均值（简陋抗混叠），声道取 ch0 即可（回声相关不依赖声像）
    let acc = 0
    const base = i * factor
    for (let j = 0; j < factor; j++) acc += samples[(base + j) * channels]
    out[i] = acc / factor
  }
  return out
}

/**
 * 在 startS 处取 WINDOW_S 窗口做归一化互相关，搜索 ±MAX_OFFSET_S。
 * 返回最佳 lag（秒，正=system 偏晚）与相关度；能量过低返回 null。
 */
function correlateAt(
  micDs: Float32Array,
  sysDs: Float32Array,
  rate: number,
  startS: number
): { lagS: number; corr: number } | null {
  const winLen = Math.floor(WINDOW_S * rate)
  const maxLag = Math.floor(MAX_OFFSET_S * rate)
  const start = Math.floor(startS * rate)
  const mic = micDs.subarray(start, start + winLen)
  if (mic.length < winLen) return null

  let micEnergy = 0
  for (let i = 0; i < winLen; i++) micEnergy += mic[i] * mic[i]
  // mic 该段近乎静音（没说话也没外放拾音）时相关无意义
  if (micEnergy / winLen < 100 * 100) return null

  let bestLag = 0
  let bestCorr = 0
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    const sStart = start + lag
    if (sStart < 0 || sStart + winLen > sysDs.length) continue
    let cross = 0
    let sysEnergy = 0
    for (let i = 0; i < winLen; i++) {
      const s = sysDs[sStart + i]
      cross += mic[i] * s
      sysEnergy += s * s
    }
    const denom = Math.sqrt(micEnergy * sysEnergy)
    const corr = denom > 0 ? cross / denom : 0
    if (corr > bestCorr) {
      bestCorr = corr
      bestLag = lag
    }
  }
  return { lagS: bestLag / rate, corr: bestCorr }
}
