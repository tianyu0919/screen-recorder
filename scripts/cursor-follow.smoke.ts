/**
 * 放大期间鼠标即时跟随冒烟验证：
 *   npx -y tsx --tsconfig tsconfig.web.json scripts/cursor-follow.smoke.ts
 */
import type { RecordingEvents } from '@shared/types'
import { deriveTimelineEffects } from '../src/timeline/derive'
import { DEFAULT_MOTION_PARAMS, generateCameraKeyframes } from '../src/timeline/keyframes'
import { buildZoomSegments } from '../src/timeline/segments'
import { createCameraAnimator, sampleCameraAt } from '../src/timeline/spring'

let failures = 0
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) console.log(`ok   ${name}`)
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
const derive = (events: RecordingEvents, overrides: Record<number, number> = {}) =>
  deriveTimelineEffects({ events, canvas, durationMs: 3000 }, DEFAULT_MOTION_PARAMS, overrides).keyframes

const inside = derive(
  makeEvents({
    clicks: [{ t: 1000, x: 960, y: 540, button: 1 }],
    mouseTrack: [
      [1000, 960, 540],
      [1200, 1100, 600]
    ]
  })
)
const insideMove = inside.find((keyframe) => keyframe.t === 1200)
check(
  '安全区已移除，小幅有效移动立即更新目标',
  insideMove?.target.x === 1100 && insideMove.target.y === 600,
  JSON.stringify(insideMove)
)

const outsideEvents = makeEvents({
  clicks: [{ t: 1000, x: 960, y: 540, button: 1 }],
  mouseTrack: [
    [1000, 960, 540],
    [1200, 1100, 540],
    [1300, 1400, 540],
    [2600, 1800, 540]
  ]
})
const outside = derive(outsideEvents)
const outsideFrame = outside.find((keyframe) => keyframe.t === 1300)
check(
  '鼠标位置直接成为跟随目标',
  outsideFrame?.target.x === 1400 && outsideFrame.target.y === 540 && outsideFrame.target.zoom === 2,
  JSON.stringify(outsideFrame)
)
const segments = buildZoomSegments(outside, 3000)
check('位置跟随不拆分原有运镜片段', segments.length === 1 && segments[0].zoom === 2)
check('回归全景后停止跟随', !outside.some((keyframe) => keyframe.t === 2600))

const dense = derive(
  makeEvents({
    clicks: [
      { t: 1000, x: 960, y: 540, button: 1 },
      { t: 1800, x: 600, y: 540, button: 1 }
    ],
    mouseTrack: [
      [1300, 1400, 540],
      [1700, 1500, 540],
      [1900, 1200, 540]
    ]
  })
)
const secondFocus = dense.find((keyframe) => keyframe.t === 1600)
const afterSecondClick = dense.find((keyframe) => keyframe.t === 1700)
check(
  '密集点击优先切换新焦点并继续跟随',
  secondFocus?.target.x === 600 && afterSecondClick?.target.x === 1440,
  JSON.stringify(dense)
)

const zoom3 = derive(outsideEvents, { 800: 3 })
const zoom3Frame = zoom3.find((keyframe) => keyframe.t === 1300)
check(
  '倍率覆盖后按最终 zoom 钳制即时目标',
  zoom3Frame?.target.zoom === 3 && zoom3Frame.target.x === 1400,
  JSON.stringify(zoom3Frame)
)

const lowZoomEdge = derive(
  makeEvents({ clicks: [{ t: 1000, x: 10, y: 10, button: 1 }] }),
  { 800: 1.2 }
)
const lowZoomFocus = lowZoomEdge.find((keyframe) => keyframe.t === 800)
check(
  '降低片段倍率后重新执行边缘钳制',
  lowZoomFocus?.target.x === 800 && lowZoomFocus.target.y === 450,
  JSON.stringify(lowZoomFocus)
)

const edge = derive(
  makeEvents({
    clicks: [{ t: 1000, x: 960, y: 540, button: 1 }],
    mouseTrack: [
      [1000, 960, 540],
      [1200, 1910, 1070]
    ]
  })
)
const edgeFrame = edge.find((keyframe) => keyframe.t === 1200)
check(
  '画面边缘钳制有效',
  edgeFrame?.target.x === 1440 && edgeFrame.target.y === 810,
  JSON.stringify(edgeFrame)
)

const jitter = derive(
  makeEvents({
    clicks: [{ t: 1000, x: 960, y: 540, button: 1 }],
    mouseTrack: [
      [1000, 960, 540],
      [1080, 1151, 540],
      [1160, 1152, 540]
    ]
  })
)
check('小于 2px 的像素级抖动被过滤', jitter.length === 4, JSON.stringify(jitter))

const highFrequencyTrack: RecordingEvents['mouseTrack'] = []
for (let t = 1000; t < 2500; t += 8) highFrequencyTrack.push([t, 960 + (t - 1000), 540])
const bounded = derive(
  makeEvents({
    clicks: [{ t: 1000, x: 960, y: 540, button: 1 }],
    mouseTrack: highFrequencyTrack
  })
)
check('120Hz 轨迹按 32ms 有界采样', bounded.length <= 51, String(bounded.length))

const followFrame = bounded.find((keyframe) => keyframe.spring?.stiffness === 520)
check(
  '跟随目标使用快速轻量平滑',
  followFrame?.spring?.damping === 42,
  JSON.stringify(followFrame)
)

const noTrackEvents = makeEvents({ clicks: [{ t: 1000, x: 960, y: 540, button: 1 }] })
const noTrackDerived = derive(noTrackEvents)
const noTrackBase = generateCameraKeyframes(noTrackEvents, canvas)
check('空鼠标轨迹保持原有点击运镜', JSON.stringify(noTrackDerived) === JSON.stringify(noTrackBase))

const offline = sampleCameraAt(outside, canvas, 1600)
const realtime = createCameraAnimator(outside, canvas).reset(1600)
check(
  '实时预览与离线采样结果一致',
  Math.abs(realtime.x - offline.x) < 1e-9 &&
    Math.abs(realtime.y - offline.y) < 1e-9 &&
    Math.abs(realtime.zoom - offline.zoom) < 1e-9
)

console.log(failures === 0 ? '\n全部通过' : `\n${failures} 项失败`)
process.exit(failures === 0 ? 0 : 1)
