/**
 * src/export 冒烟验证（无测试框架，直接跑）：
 *   TSX_TSCONFIG_PATH=tsconfig.web.json npx -y tsx scripts/export.smoke.ts
 * 覆盖 node 可测的纯逻辑：WAV 解析（audio.ts）与取帧游标语义（decoder.ts 的 frameCursorDecision）。
 * WebGL/WebCodecs 路径无法无头验证，需在应用内人工冒烟（对照 checklist.md）。
 */
import { parseWav, mixPcm, type WavData } from '../src/export/audio'
import { ExportError, frameCursorDecision } from '../src/export/decoder'

let failures = 0
function check(name: string, cond: boolean, detail = '') {
  if (cond) console.log(`ok   ${name}`)
  else {
    failures++
    console.error(`FAIL ${name} ${detail}`)
  }
}

/** 构造 16-bit PCM WAV（可带额外 chunk、fmt 在 data 之后等乱序情形） */
function makeWav(options: {
  sampleRate?: number
  channels?: number
  frames?: number
  audioFormat?: number
  bitsPerSample?: number
  extraChunkBeforeData?: boolean
}): ArrayBuffer {
  const { sampleRate = 48000, channels = 2, frames = 4, audioFormat = 1, bitsPerSample = 16 } = options
  const dataSize = frames * channels * 2
  const chunks: Uint8Array[] = []
  const fmt = new Uint8Array(16)
  const fv = new DataView(fmt.buffer)
  fv.setUint16(0, audioFormat, true)
  fv.setUint16(2, channels, true)
  fv.setUint32(4, sampleRate, true)
  fv.setUint16(14, bitsPerSample, true)
  const wrap = (id: string, body: Uint8Array): Uint8Array => {
    const out = new Uint8Array(8 + body.length)
    for (let i = 0; i < 4; i++) out[i] = id.charCodeAt(i)
    new DataView(out.buffer).setUint32(4, body.length, true)
    out.set(body, 8)
    return out
  }
  if (options.extraChunkBeforeData) chunks.push(wrap('LIST', new Uint8Array(7))) // 奇数长度 → 2 字节对齐
  chunks.push(wrap('fmt ', fmt))
  const pcm = new Uint8Array(dataSize)
  if (dataSize >= 2) new DataView(pcm.buffer).setInt16(0, 12345, true)
  chunks.push(wrap('data', pcm))
  const total = chunks.reduce((s, c) => s + c.length + (c.length % 2), 0)
  const out = new Uint8Array(12 + total)
  out.set([0x52, 0x49, 0x46, 0x46], 0) // RIFF
  new DataView(out.buffer).setUint32(4, total + 4, true)
  out.set([0x57, 0x41, 0x56, 0x45], 8) // WAVE
  let offset = 12
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length + (c.length % 2)
  }
  return out.buffer
}

// ── WAV 解析 ──────────────────────────────────────────────────
const wav = parseWav(makeWav({ sampleRate: 44100, channels: 1, frames: 8 }))
check('WAV 单声道 44.1k 解析', wav.sampleRate === 44100 && wav.channels === 1 && wav.samples.length === 8)
check('WAV 采样值正确', wav.samples[0] === 12345)

const messy = parseWav(makeWav({ channels: 2, frames: 4, extraChunkBeforeData: true }))
check('WAV 带 LIST chunk（奇数长度对齐）解析', messy.channels === 2 && messy.samples.length === 8)

for (const [name, bad] of [
  ['非 PCM', makeWav({ audioFormat: 3 })],
  ['非 16bit', makeWav({ bitsPerSample: 24 })],
  ['无 RIFF 头', new ArrayBuffer(64)],
  ['无 data chunk', makeWav({ frames: 0 })]
] as const) {
  try {
    parseWav(bad)
    check(`WAV 损坏/不支持抛错（${name}）`, false)
  } catch (e) {
    check(`WAV 损坏/不支持抛错（${name}）`, e instanceof ExportError)
  }
}

// ── 双轨混音（mixPcm） ─────────────────────────────────────────
const wavOf = (sampleRate: number, channels: number, value: number, frames: number): WavData => ({
  sampleRate,
  channels,
  samples: new Int16Array(frames * channels).fill(value)
})

// 混合幅值：逐采样相加
const mixed = mixPcm(wavOf(48000, 2, 1000, 4), wavOf(48000, 2, 2000, 4))!
check('混音 逐采样相加', mixed.samples.length === 8 && mixed.samples[0] === 3000 && mixed.samples[7] === 3000)

// clamp 防削波
const clipped = mixPcm(wavOf(48000, 1, 30000, 2), wavOf(48000, 1, 10000, 2))!
check('混音 clamp 到 int16 上限', clipped.samples[0] === 32767 && clipped.samples[1] === 32767)
const clippedNeg = mixPcm(wavOf(48000, 1, -30000, 1), wavOf(48000, 1, -10000, 1))!
check('混音 clamp 到 int16 下限', clippedNeg.samples[0] === -32768)

// 采样率不同：以较高者为准，低音轨线性插值（常数信号插值后仍为常数），长度按时间对齐
const resampled = mixPcm(wavOf(48000, 1, 100, 480), wavOf(24000, 1, 100, 240))!
check(
  '混音 重采样到较高采样率且长度按秒对齐',
  resampled.sampleRate === 48000 && resampled.samples.length === 480 &&
    resampled.samples.every((s) => s === 200),
  `len=${resampled.samples.length} s[0]=${resampled.samples[0]}`
)

// 声道不同：以较多者为准，单声道轨复制到各声道
const upmixed = mixPcm(wavOf(48000, 1, 500, 2), wavOf(48000, 2, 100, 2))!
check(
  '混音 单声道轨复制到立体声',
  upmixed.channels === 2 && upmixed.samples[0] === 600 && upmixed.samples[1] === 600
)

// 单轨直通 / 双缺
const solo = wavOf(44100, 1, 42, 3)
check('混音 单轨直通（同一引用）', mixPcm(solo, null) === solo && mixPcm(null, solo) === solo)
check('混音 双缺为 null', mixPcm(null, null) === null)

// 长度取较长轨，短轨结束后按静音
const longTail = mixPcm(wavOf(48000, 1, 100, 2), wavOf(48000, 1, 100, 4))!
check(
  '混音 短轨结束后静音',
  longTail.samples.length === 4 && longTail.samples[2] === 100 && longTail.samples[3] === 100
)

// ── 取帧游标语义（frameCursorDecision） ─────────────────────────
// 源 60fps：帧时间戳（µs，模拟取整误差），导出时间轴同 60fps
const srcTs = (k: number) => Math.round((k * 1e6) / 60)
const frames = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => ({ timestamp: srcTs(from + i) }))

// t=0：首帧即答案
let d = frameCursorDecision(frames(0, 3), 0, false)
check('游标 t=0 取首帧', d.status === 'ready' && d.drop === 0, JSON.stringify(d))

// t=第 5 帧：队列里 0..7 帧，应丢弃 0..4，队首为第 5 帧
d = frameCursorDecision(frames(0, 8), srcTs(5), false)
check('游标推进到第 5 帧', d.status === 'ready' && d.drop === 5, JSON.stringify(d))

// 取整误差：源第 1 帧 ts=16667 比 t=16666.67 大 0.33µs，容差内应命中该帧而非停留在前一帧
d = frameCursorDecision(
  [{ timestamp: 0 }, { timestamp: 16667 }, { timestamp: 33334 }],
  16666.67,
  false
)
check('游标容差（取整误差不误跳帧）', d.status === 'ready' && d.drop === 1, JSON.stringify(d))

// 仅剩 1 帧且解码未耗尽：需要更多输入确认没有更晚的候选帧
d = frameCursorDecision(frames(5, 1), srcTs(5), false)
check('仅剩 1 帧未耗尽 → need-more', d.status === 'need-more' && d.drop === 0)

// 仅剩 1 帧且已耗尽：直接用最后一帧拖尾（源比导出时间轴短）
d = frameCursorDecision(frames(5, 1), srcTs(100), true)
check('尾帧拖尾（源耗尽后保持最后一帧）', d.status === 'ready' && d.drop === 0)

// 全部过期且已耗尽：无帧可取
d = frameCursorDecision([], 0, true)
check('空队列已耗尽 → exhausted', d.status === 'exhausted')

// 全部过期但未耗尽：继续拉取
d = frameCursorDecision([], srcTs(3), false)
check('空队列未耗尽 → need-more', d.status === 'need-more')

// t 早于首帧：钳制到首帧
d = frameCursorDecision(frames(2, 3), 0, false)
check('t 早于首帧 → 取首帧', d.status === 'ready' && d.drop === 0)

// ── 游标驱动仿真：不规则帧流上随导出时间轴推进 ──────────────────
// 复刻真实 MediaRecorder webm 的帧分布：~17ms 基准间隔 + 偶发 50–556ms 大空洞
// （实测 rec-1787216273034 的 delta 直方图）。模拟 frameAt 的完整循环：
// need-more 时按序补帧入队，断言全程"返回帧 = 不晚于 t 的最近帧"、时间戳单调不减、
// 时间轴走完后游标必须推进到接近末尾（防"全程返回第一帧"回归）。
function simulateCursor(srcTimestampsUs: number[]): { chosen: number[]; lastGridT: number } {
  const queue: { timestamp: number }[] = []
  let feedPos = 0
  const chosen: number[] = []
  let ended = false
  const durationUs = srcTimestampsUs[srcTimestampsUs.length - 1]
  const totalFrames = Math.floor(durationUs / (1e6 / 60)) + 1
  // 与 pipeline 一致：t 每帧重新计算（不累加），避免浮点误差漂移
  for (let i = 0; i < totalFrames; i++) {
    const tUs = (i * 1e6) / 60
    // 与 frameAt 同构的循环
    for (let guard = 0; ; guard++) {
      if (guard > srcTimestampsUs.length + 4) throw new Error('仿真死循环')
      const dec = frameCursorDecision(queue, tUs, ended)
      for (let x = 0; x < dec.drop; x++) queue.shift()
      if (dec.status === 'ready') {
        chosen.push(queue[0].timestamp)
        break
      }
      if (dec.status === 'exhausted') throw new Error('不应耗尽：t 未超出最后一帧')
      // need-more：补一帧（模拟 feedOne + 解码输出）
      if (feedPos >= srcTimestampsUs.length) {
        ended = true
      } else {
        queue.push({ timestamp: srcTimestampsUs[feedPos++] })
      }
    }
  }
  return { chosen, lastGridT: ((totalFrames - 1) * 1e6) / 60 }
}

// 构造不规则帧流：17ms 基准，每 ~40 帧插一个 120ms 空洞，结尾一个 556ms 大空洞
const irregular: number[] = [0]
for (let k = 1; k < 3880; k++) {
  const gap = k % 40 === 0 ? 120_000 : 17_000
  irregular.push(irregular[k - 1] + gap)
}
irregular.push(irregular[irregular.length - 1] + 556_000)

const sim = simulateCursor(irregular)
check(
  '游标仿真：每个导出帧都有源帧',
  sim.chosen.length === Math.floor(irregular[irregular.length - 1] / (1e6 / 60)) + 1,
  `chosen=${sim.chosen.length}`
)
let monotone = true
let correctPick = true
let mismatchLogged = 0
for (let i = 0; i < sim.chosen.length; i++) {
  if (i > 0 && sim.chosen[i] < sim.chosen[i - 1]) monotone = false
  const tUs = (i * 1e6) / 60
  // 期望值：不晚于 t(+1ms 容差) 的最大帧时间戳
  let expect = irregular[0]
  for (const ts of irregular) {
    if (ts <= tUs + 1000) expect = ts
    else break
  }
  if (sim.chosen[i] !== expect) {
    correctPick = false
    if (mismatchLogged++ < 5) {
      console.error(
        `  mismatch @i=${i} t=${tUs.toFixed(0)}us chosen=${sim.chosen[i]} expect=${expect}`
      )
    }
  }
}
check('游标仿真：返回帧时间戳单调不减', monotone)
check('游标仿真：每帧都是"不晚于 t 的最近帧"', correctPick)
// 末尾：最后一个时间轴网格点之后到达的源帧不会被选中（t 没到），
// 但游标必须推进到"不晚于末尾 t 的最后一帧"，且全程取到了绝大多数不同源帧
let expectLast = irregular[0]
for (const ts of irregular) {
  if (ts <= sim.lastGridT + 1000) expectLast = ts
  else break
}
const distinct = new Set(sim.chosen).size
check(
  '游标仿真：末尾游标推进到位且全程取到绝大多数源帧（非卡在首帧）',
  sim.chosen[sim.chosen.length - 1] === expectLast && distinct > irregular.length * 0.95,
  `last=${sim.chosen[sim.chosen.length - 1]} expect=${expectLast} distinct=${distinct}/${irregular.length}`
)

console.log(failures === 0 ? '\n全部通过' : `\n${failures} 项失败`)
process.exit(failures === 0 ? 0 : 1)
