/**
 * src/timeline 冒烟验证（无测试框架，直接跑）：
 *   TSX_TSCONFIG_PATH=tsconfig.web.json npx -y tsx scripts/timeline.smoke.ts
 * 覆盖 Task 1.1–1.4 的关键场景（对照 spec.md 的 Scenario）。
 */
import type { RecordingEvents } from '@shared/types'
import { buildTimeline, parseEventsJson, TimelineParseError } from '../src/timeline/types'
import { displayToCanvas, clampCameraToCanvas } from '../src/timeline/coords'
import { generateCameraKeyframes, DEFAULT_MOTION_PARAMS } from '../src/timeline/keyframes'
import { sampleCameraAt, createCameraAnimator } from '../src/timeline/spring'

let failures = 0
function check(name: string, cond: boolean, detail = '') {
  if (cond) console.log(`ok   ${name}`)
  else {
    failures++
    console.error(`FAIL ${name} ${detail}`)
  }
}

function makeEvents(overrides: Partial<RecordingEvents> = {}): RecordingEvents {
  return {
    version: 1,
    startTime: 1723987200000,
    display: { id: 1, bounds: [0, 0, 1920, 1080], scaleFactor: 1 },
    video: { width: 1920, height: 1080, fps: 60, file: 'screen.webm' },
    mouseTrack: [],
    clicks: [],
    keys: [],
    ...overrides
  }
}
const canvas = { width: 1920, height: 1080 }

// ── Task 1.1: 加载与 schema 校验 ──────────────────────────────
const tl = buildTimeline(makeEvents({ clicks: [{ t: 1200, x: 512, y: 300, button: 1 }] }))
check('1.1 合法会话构建成功', tl.canvas.width === 1920 && tl.durationMs === 1200)
try {
  buildTimeline({ version: 2 })
  check('1.1 version 不兼容抛 TimelineParseError', false)
} catch (e) {
  check(
    '1.1 version 不兼容抛 TimelineParseError',
    e instanceof TimelineParseError && e.message.includes('会话数据损坏或不兼容')
  )
}
try {
  parseEventsJson('{oops')
  check('1.1 非法 JSON 抛 TimelineParseError', false)
} catch (e) {
  check('1.1 非法 JSON 抛 TimelineParseError', e instanceof TimelineParseError)
}

// ── Task 1.2: 多显示器坐标换算 ────────────────────────────────
const retina = { id: 1, bounds: [0, 0, 2560, 1440] as [number, number, number, number], scaleFactor: 2 }
const p1 = displayToCanvas(retina, 512, 300)
check('1.2 scaleFactor=2 换算', p1.x === 1024 && p1.y === 600, JSON.stringify(p1))
const secondary = { id: 2, bounds: [2560, 0, 2560, 1440] as [number, number, number, number], scaleFactor: 2 }
const p2 = displayToCanvas(secondary, 2560 + 512, 300)
check('1.2 副屏 bounds 原点偏移', p2.x === 1024 && p2.y === 600, JSON.stringify(p2))

// ── Task 1.3: 自动关键帧生成 ──────────────────────────────────
const single = generateCameraKeyframes(
  makeEvents({ clicks: [{ t: 1200, x: 512, y: 300, button: 1 }] }),
  canvas
)
check(
  '1.3 单次点击: t≈1000 缩放目标',
  single.length === 3 &&
    single[1].t === 1000 &&
    single[1].target.zoom === 2 &&
    single[1].target.x === 512 &&
    single[1].target.y === 300,
  JSON.stringify(single)
)
check(
  '1.3 单次点击: 停留后回归全景',
  single[2].t === 1200 + DEFAULT_MOTION_PARAMS.dwellMs && single[2].target.zoom === 1
)

const dense = generateCameraKeyframes(
  makeEvents({
    clicks: [
      { t: 1200, x: 400, y: 300, button: 1 },
      { t: 2000, x: 900, y: 500, button: 1 }
    ]
  }),
  canvas
)
const denseReturnCount = dense.filter((k) => k.target.zoom === 1 && k.t > 0).length
check(
  '1.3 密集点击合并（间隔<停留时长不插回归帧）',
  dense.length === 4 && denseReturnCount === 1,
  JSON.stringify(dense)
)

const edge = generateCameraKeyframes(
  makeEvents({ clicks: [{ t: 5000, x: 10, y: 10, button: 1 }] }),
  canvas
)
check(
  '1.3 边缘钳制（视口不出画布）',
  edge[1].target.x === 480 && edge[1].target.y === 270, // 1920/(2*2), 1080/(2*2)
  JSON.stringify(edge[1])
)

const empty = generateCameraKeyframes(makeEvents(), canvas)
check('1.3 无点击降级: 全程 1.0x 全景', empty.length === 1 && empty[0].target.zoom === 1)

const clamped = clampCameraToCanvas({ x: -50, y: 99999, zoom: 3 }, canvas)
check('1.3 clampCameraToCanvas 基础钳制', clamped.x === 320 && clamped.y === 900 && clamped.zoom === 3)

// ── Task 1.4: spring 求值器 ───────────────────────────────────
const kfs = generateCameraKeyframes(
  makeEvents({ clicks: [{ t: 1200, x: 512, y: 300, button: 1 }] }),
  canvas
)
const STEP = 16
let prev = sampleCameraAt(kfs, canvas, 0)
let continuous = true
let inCanvas = true
for (let t = STEP; t <= 4500; t += STEP) {
  const s = sampleCameraAt(kfs, canvas, t)
  // 16ms 帧间位移上限：zoom < 0.2/帧、位置 < 300px/帧（经验值，防瞬时跳变）
  if (
    Math.abs(s.zoom - prev.zoom) > 0.2 ||
    Math.abs(s.x - prev.x) > 300 ||
    Math.abs(s.y - prev.y) > 300 ||
    Number.isNaN(s.x + s.y + s.zoom)
  ) {
    continuous = false
  }
  const halfW = canvas.width / (2 * s.zoom)
  const halfH = canvas.height / (2 * s.zoom)
  if (s.x < halfW - 1e-6 || s.x > canvas.width - halfW + 1e-6) inCanvas = false
  if (s.y < halfH - 1e-6 || s.y > canvas.height - halfH + 1e-6) inCanvas = false
  if (s.zoom < 1 - 1e-6) inCanvas = false
  prev = s
}
check('1.4 全程连续无跳变', continuous)
check('1.4 全程视口在画布内（含 spring 过冲）', inCanvas)

const zoomed = sampleCameraAt(kfs, canvas, 1400)
check(
  '1.4 点击时刻已缩放到目标附近',
  Math.abs(zoomed.zoom - 2) < 0.05 && Math.abs(zoomed.x - 512) < 8 && Math.abs(zoomed.y - 300) < 8,
  JSON.stringify(zoomed)
)
const settled = sampleCameraAt(kfs, canvas, 4500)
check(
  '1.4 回归后收敛到 1.0x 全景',
  Math.abs(settled.zoom - 1) < 0.01 && Math.abs(settled.x - 960) < 2 && Math.abs(settled.y - 540) < 2,
  JSON.stringify(settled)
)

const a1 = sampleCameraAt(kfs, canvas, 1500)
const a2 = sampleCameraAt(kfs, canvas, 1500)
check('1.4 采样确定性', a1.x === a2.x && a1.y === a2.y && a1.zoom === a2.zoom)

// 增量动画器与全量重放一致（实时播放路径）
const animator = createCameraAnimator(kfs, canvas)
animator.reset()
let animState = animator.sample()
for (let t = 0; t < 1500; t += STEP) animState = animator.step(STEP)
check(
  // 两种调用路径的子步边界不同（16ms 分块 vs 一次推进），允许浮点级偏差
  '1.4 animator 增量积分与重放一致',
  Math.abs(animState.zoom - a1.zoom) < 0.01 && Math.abs(animState.x - a1.x) < 2,
  `anim=${JSON.stringify(animState)} replay=${JSON.stringify(a1)}`
)
const seeked = animator.reset(1400)
check(
  '1.4 animator seek 与直接采样一致',
  Math.abs(seeked.zoom - zoomed.zoom) < 1e-9 && Math.abs(seeked.x - zoomed.x) < 1e-9
)

// 空关键帧：全程全景
const idle = sampleCameraAt(empty, canvas, 99999)
check('1.4 无关键帧保持 1.0x', idle.zoom === 1 && idle.x === 960 && idle.y === 540)

console.log(failures === 0 ? '\n全部通过' : `\n${failures} 项失败`)
process.exit(failures === 0 ? 0 : 1)
