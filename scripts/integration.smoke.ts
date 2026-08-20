/**
 * kr-02 Phase 4 集成冒烟（Task 4.1，对照 checklist.md 可程序化条目）：
 *   TSX_TSCONFIG_PATH=tsconfig.web.json npx -y tsx scripts/integration.smoke.ts
 *
 * 数据源：真实 kr-01 录制会话，目录为 app.getPath('userData')/recordings
 * （appName = package.json "name" = screen-recorder，electron/main 未调用 setName）。
 * 找不到真实会话时回退到符合 shared/types.ts 契约的合成会话，并在输出中明示。
 *
 * 链路：读 events.json → parseEventsJson → generateCameraKeyframes →
 * 逐帧 sampleCameraAt 全时间轴（16ms 步进），验证时序/回归/合并/连续性/钳制/降级。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { RecordingEvents } from '@shared/types'
import { parseEventsJson, TimelineParseError, type Timeline } from '../src/timeline/types'
import {
  DEFAULT_MOTION_PARAMS,
  generateCameraKeyframes,
  type MotionParams
} from '../src/timeline/keyframes'
import { displayToCanvas } from '../src/timeline/coords'
import { sampleCameraAt } from '../src/timeline/spring'

let failures = 0
function check(name: string, cond: boolean, detail = '') {
  if (cond) console.log(`ok   ${name}`)
  else {
    failures++
    console.error(`FAIL ${name} ${detail}`)
  }
}
function note(msg: string) {
  console.log(`note ${msg}`)
}

const P = DEFAULT_MOTION_PARAMS
const FRAME_MS = 16

// ── 会话发现：真实优先，合成兜底 ──────────────────────────────
const realRoot = join(homedir(), 'Library/Application Support/screen-recorder/recordings')
interface SessionData {
  id: string
  eventsJson: string
  videoPath: string | null
}
function discoverSessions(): { sessions: SessionData[]; real: boolean } {
  if (existsSync(realRoot)) {
    const out: SessionData[] = []
    for (const id of readdirSync(realRoot)) {
      const eventsPath = join(realRoot, id, 'events.json')
      if (!existsSync(eventsPath)) continue
      const events = JSON.parse(readFileSync(eventsPath, 'utf8')) as RecordingEvents
      const videoPath = join(realRoot, id, events.video?.file ?? 'screen.webm')
      out.push({ id, eventsJson: readFileSync(eventsPath, 'utf8'), videoPath: existsSync(videoPath) ? videoPath : null })
    }
    if (out.length > 0) return { sessions: out, real: true }
  }
  return { sessions: [], real: false }
}

const { sessions, real } = discoverSessions()
if (real) {
  note(`使用 ${sessions.length} 个真实 kr-01 会话: ${sessions.map((s) => s.id).join(', ')}`)
} else {
  note('未发现真实录制会话，使用合成会话（符合 shared/types.ts 契约）')
  const synthetic: RecordingEvents = {
    version: 1,
    startTime: Date.now(),
    display: { id: 1, bounds: [0, 0, 1728, 1117], scaleFactor: 2 },
    video: { width: 3456, height: 2234, fps: 60, file: 'screen.webm' },
    mouseTrack: [[0, 100, 100], [10000, 500, 500]],
    clicks: [
      { t: 1200, x: 512, y: 300, button: 1 },
      { t: 1350, x: 900, y: 600, button: 1 }, // 密集点击
      { t: 9000, x: 10, y: 10, button: 1 } // 边缘点击
    ],
    keys: []
  }
  sessions.push({ id: 'synthetic', eventsJson: JSON.stringify(synthetic), videoPath: null })
}

// ── WebM Duration 元数据解析（EBML 0x4489，Info 段在文件头部） ──
function webmDurationMs(path: string): number | null {
  const buf = readFileSync(path).subarray(0, 1 << 20)
  const i = buf.indexOf(Buffer.from([0x44, 0x89]))
  if (i < 0) return null
  const b0 = buf[i + 2]
  let len = 1
  let mask = 0x80
  while (!(b0 & mask)) {
    mask >>= 1
    len++
  }
  const size = Number(buf.readBigUInt64BE(i + 2) & ((1n << BigInt(7 * len)) - 1n))
  if (size === 8) return buf.readDoubleBE(i + 2 + len)
  if (size === 4) return buf.readFloatBE(i + 2 + len)
  return null
}

// ── 通用验证：单会话全时间轴逐帧采样 ──────────────────────────
function verifySession(sd: SessionData, params: MotionParams): { timeline: Timeline; kfs: ReturnType<typeof generateCameraKeyframes> } {
  const timeline = parseEventsJson(sd.eventsJson)
  const { canvas, events } = timeline
  const kfs = generateCameraKeyframes(events, canvas, params)
  console.log(`\n── ${sd.id}: canvas=${canvas.width}x${canvas.height} clicks=${events.clicks.length} keyframes=${kfs.length}`)

  // checklist: 逐帧采样 zoom 曲线连续、无瞬时跳变；全程钳制在画布内
  const end = Math.max(timeline.durationMs, kfs[kfs.length - 1].t) + 2000
  let prev = sampleCameraAt(kfs, canvas, 0)
  let continuous = true
  let inCanvas = true
  for (let t = FRAME_MS; t <= end; t += FRAME_MS) {
    const s = sampleCameraAt(kfs, canvas, t)
    // 16ms 帧间位移上限（经验值）：瞬时跳变 = 一帧走完全程，远超此界
    if (
      Math.abs(s.zoom - prev.zoom) > 0.35 ||
      Math.abs(s.x - prev.x) > canvas.width / 4 ||
      Math.abs(s.y - prev.y) > canvas.height / 4 ||
      Number.isNaN(s.x + s.y + s.zoom)
    ) {
      continuous = false
    }
    const halfW = canvas.width / (2 * s.zoom)
    const halfH = canvas.height / (2 * s.zoom)
    if (s.zoom < 1 - 1e-6) inCanvas = false
    if (s.x < halfW - 1e-6 || s.x > canvas.width - halfW + 1e-6) inCanvas = false
    if (s.y < halfH - 1e-6 || s.y > canvas.height - halfH + 1e-6) inCanvas = false
    prev = s
  }
  check(`${sd.id} 逐帧 zoom 曲线连续无跳变（0..${end}ms @16ms）`, continuous)
  check(`${sd.id} 全程视口钳制在画布内（含 spring 过冲）`, inCanvas)

  // checklist: 关键帧时序 —— 每次点击前 ~leadMs 缩放；点击区域成为焦点
  const clicks = [...events.clicks].sort((a, b) => a.t - b.t)
  let leadOk = clicks.length > 0
  for (const c of clicks) {
    const kf = kfs.find((k) => k.t === Math.max(0, c.t - params.leadMs) && k.target.zoom === params.targetZoom)
    if (!kf) {
      leadOk = false
      break
    }
    // 焦点 = display→canvas 换算后的点击点（边缘点击会被钳制，只验证未钳制情形）
    const pt = displayToCanvas(events.display, c.x, c.y)
    const halfW = canvas.width / (2 * params.targetZoom)
    const halfH = canvas.height / (2 * params.targetZoom)
    const unclamped =
      pt.x >= halfW && pt.x <= canvas.width - halfW && pt.y >= halfH && pt.y <= canvas.height - halfH
    if (unclamped && (Math.abs(kf.target.x - pt.x) > 1e-6 || Math.abs(kf.target.y - pt.y) > 1e-6)) {
      leadOk = false
      break
    }
  }
  if (clicks.length > 0) check(`${sd.id} 每次点击前 ${params.leadMs}ms 生成缩放关键帧且焦点正确`, leadOk)

  // checklist: 无操作超回归阈值 → 回归 1.0x；密集点击（间隔<停留）不插回归帧
  let returnOk = true
  let denseOk = true
  for (let i = 0; i < clicks.length; i++) {
    const gap = i + 1 < clicks.length ? clicks[i + 1].t - clicks[i].t : Infinity
    const hasReturn = kfs.some((k) => k.t === clicks[i].t + params.dwellMs && k.target.zoom === 1)
    if (gap >= params.dwellMs && gap > params.returnThresholdMs && !hasReturn) returnOk = false
    if (gap < params.dwellMs) {
      // 两次点击之间不允许出现回归 1.0x 的关键帧
      const between = kfs.some((k) => k.target.zoom === 1 && k.t > clicks[i].t && k.t < clicks[i + 1].t)
      if (between) denseOk = false
    }
  }
  if (clicks.length > 0) {
    check(`${sd.id} 超回归阈值后回归 1.0x 全景`, returnOk)
    check(`${sd.id} 密集点击合并不插回归帧`, denseOk)
  } else {
    // checklist: 空 clicks 降级 —— 全程 1.0x 全景
    const idle = sampleCameraAt(kfs, canvas, timeline.durationMs + 500)
    check(
      `${sd.id} 空 clicks 降级：单全景关键帧且全程 1.0x`,
      kfs.length === 1 && kfs[0].t === 0 && kfs[0].target.zoom === 1 && idle.zoom === 1
    )
  }

  // checklist(子集): scaleFactor=2 坐标换算后点击点落在视频画布内（目视重合需人工）
  let mapped = true
  for (const c of clicks) {
    const pt = displayToCanvas(events.display, c.x, c.y)
    if (pt.x < 0 || pt.x > canvas.width || pt.y < 0 || pt.y > canvas.height) mapped = false
  }
  if (clicks.length > 0) check(`${sd.id} 点击坐标经 display/scaleFactor 换算后落在画布内`, mapped)

  // checklist: 视频时长与事件时间轴一致（webm 含 Duration 元数据时程序化比对）
  if (sd.videoPath) {
    const dur = webmDurationMs(sd.videoPath)
    if (dur === null) {
      note(`${sd.id} webm 无 Duration 元数据（MediaRecorder 已知行为），时长一致性待人工确认`)
    } else {
      check(
        `${sd.id} 视频时长(${Math.round(dur)}ms) ≥ 事件时间轴末端(${timeline.durationMs}ms)，容差 3s`,
        dur >= timeline.durationMs - 100 && Math.abs(dur - timeline.durationMs) < 3000,
        `dur=${dur} timeline=${timeline.durationMs}`
      )
    }
  }
  return { timeline, kfs }
}

for (const sd of sessions) verifySession(sd, P)

// ── checklist: 损坏/版本不兼容 → 友好错误，无原始堆栈 ─────────
console.log('\n── 损坏会话错误路径')
try {
  parseEventsJson('{oops')
  check('非法 JSON 抛 TimelineParseError', false)
} catch (e) {
  check(
    '非法 JSON → TimelineParseError（友好提示，无原始堆栈）',
    e instanceof TimelineParseError && e.message.includes('会话数据损坏或不兼容')
  )
}
const firstReal = sessions[0]
if (firstReal) {
  const corrupted = JSON.stringify({ ...JSON.parse(firstReal.eventsJson), version: 2 })
  try {
    parseEventsJson(corrupted)
    check('version 不兼容抛 TimelineParseError', false)
  } catch (e) {
    check(
      'version=2 → 提示"会话数据损坏或不兼容"',
      e instanceof TimelineParseError && e.message.startsWith('会话数据损坏或不兼容')
    )
  }
}

// ── checklist: 运镜参数修改即时生效（数据层：参数→关键帧派生） ──
const withClicks = sessions.find((s) => (JSON.parse(s.eventsJson) as RecordingEvents).clicks.length > 0)
if (withClicks) {
  const tl = parseEventsJson(withClicks.eventsJson)
  const zoom3 = generateCameraKeyframes(tl.events, tl.canvas, { ...P, targetZoom: 3 })
  const base = generateCameraKeyframes(tl.events, tl.canvas, P)
  check(
    '参数改动（targetZoom 2→3）关键帧即时重算且目标变化',
    zoom3.length === base.length && zoom3.some((k, i) => k.target.zoom !== base[i]?.target.zoom)
  )
}

console.log(failures === 0 ? '\n全部通过' : `\n${failures} 项失败`)
process.exit(failures === 0 ? 0 : 1)
