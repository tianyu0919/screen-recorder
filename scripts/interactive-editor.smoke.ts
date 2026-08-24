import type { EditDocumentV1, EditDocumentV2 } from '../shared/edit'
import type { RecordingEvents } from '../shared/types'
import { parseEditDocument } from '../src/timeline/editDocument'
import { bufferedTimeWindow, clusterTimelineEvents } from '../src/timeline/eventDisplay'
import { activeKeyPromptAt, deriveRecordedKeyPrompts } from '../src/timeline/keyPrompts'
import { DEFAULT_MOTION_PARAMS } from '../src/timeline/keyframes'
import {
  createDefaultMotionEffects,
  createManualMotionEffect,
  moveMotionEffect,
  resizeMotionEffect,
  ripplesFromMotionEffects
} from '../src/timeline/motionEffects'
import { markEditDirty, resetEditAutosave } from '../src/store/editAutosave'
import type { PreviewState } from '../src/store/previewTypes'

let failures = 0
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) console.log(`ok   ${name}`)
  else {
    failures++
    console.error(`FAIL ${name} ${detail}`)
  }
}

const canvas = { width: 1920, height: 1080 }
const events: RecordingEvents = {
  version: 1,
  startTime: 0,
  display: { id: 1, bounds: [0, 0, 1920, 1080], scaleFactor: 1 },
  video: { width: 1920, height: 1080, fps: 60, file: 'screen.webm' },
  mouseTrack: [
    [800, 100, 200],
    [1000, 200, 300],
    [3000, 900, 500],
    [3200, 1100, 600]
  ],
  clicks: [{ t: 1000, x: 200, y: 300, button: 1 }],
  keys: [
    { t: 100, key: 'A' },
    { t: 200, key: 'Control' },
    { t: 260, key: 'C' },
    { t: 900, key: 'F5' }
  ]
}

const defaults = createDefaultMotionEffects(events, canvas, DEFAULT_MOTION_PARAMS, 6000)
check('自动点击物化为关联运镜', defaults.length === 1 && defaults[0].sourceClickIndices[0] === 0)
const moved = moveMotionEffect(defaults, defaults[0].id, 3000, 6000)
const movedRipple = ripplesFromMotionEffects(moved, events, canvas)[0]
check(
  '移动自动运镜同步移动波纹并按新时间采样坐标',
  moved[0].startMs === 3000 && movedRipple.t === 3200 && movedRipple.x === 1100,
  JSON.stringify({ effect: moved[0], ripple: movedRipple })
)
const startResized = resizeMotionEffect(moved, moved[0].id, 'start', 2900, 6000)
check(
  '左侧拉伸移动关联波纹锚点',
  ripplesFromMotionEffects(startResized, events, canvas)[0].t === 3100
)
const endResized = resizeMotionEffect(moved, moved[0].id, 'end', 3500, 6000)
check(
  '右侧拉伸只修改结束时间',
  endResized[0].startMs === moved[0].startMs &&
    ripplesFromMotionEffects(endResized, events, canvas)[0].t === movedRipple.t
)
check(
  '新增运镜不能与既有片段重叠',
  createManualMotionEffect(3100, 6000, DEFAULT_MOTION_PARAMS, moved) === null
)

const prompts = deriveRecordedKeyPrompts(events.keys)
check(
  '历史普通字符隐藏，快捷键与功能键保留',
  prompts.length === 2 && prompts[0].keys.join('+') === 'CTRL+C' && prompts[1].keys[0] === 'F5',
  JSON.stringify(prompts)
)
check('按键提示 1.5 秒后消失', activeKeyPromptAt(prompts, 2500) === null)

const items = prompts.map((prompt) => ({
  id: prompt.id,
  t: prompt.t,
  label: prompt.keys.join(' + '),
  kind: 'key' as const
}))
const fullWindow = { startMs: 0, endMs: 6000 }
check('空间充足时恢复事件名称', clusterTimelineEvents(items, 400, fullWindow)[0].mode === 'label')
const dense = clusterTimelineEvents([...items, { ...items[0], id: 'near', t: items[0].t + 10 }], 30, fullWindow)
check('事件密集时降级为圆点聚合', dense[0].mode === 'dot' && dense[0].items.length >= 2)
const window = bufferedTimeWindow(4000, 1000, 10000, 60000)
check('事件虚拟化保留前后各一屏缓冲', window.startMs === 18000 && window.endMs === 36000)

const document: EditDocumentV1 = {
  version: 1,
  updatedAt: new Date(0).toISOString(),
  motionParams: DEFAULT_MOTION_PARAMS,
  motionEffects: moved,
  manualKeyPrompts: [],
  hiddenRecordedKeyIndices: [0],
  cuts: [],
  audioGain: { mic: 0.5, system: 0.8 },
  customAudio: [],
  keyboardOverlay: { x: 0.5, y: 0.86 }
}
const restored = parseEditDocument(JSON.stringify(document))
check(
  'V1 edit.json 迁移后恢复效果并补齐 V2 默认值',
  restored.version === 2 && restored.motionEffects[0].startMs === 3000 &&
    restored.keyboardOverlay.y === 0.86 && restored.motionEnabled &&
    !restored.audioMute.mic && !restored.renderSettings.backgroundEnabled &&
    restored.renderSettings.backgroundPaddingPercent === 6
)
const legacyV2 = parseEditDocument(JSON.stringify({
  ...restored,
  renderSettings: { backgroundEnabled: true, backgroundColor: '#16181D' }
}))
check(
  '旧 V2 缺少背景边距时补齐 6%',
  legacyV2.renderSettings.backgroundPaddingPercent === 6
)
const boundedV2 = parseEditDocument(JSON.stringify({
  ...restored,
  renderSettings: {
    backgroundEnabled: true,
    backgroundColor: '#16181D',
    backgroundPaddingPercent: 99
  }
}))
check(
  'V2 背景边距越界时钳制到 20%',
  boundedV2.renderSettings.backgroundPaddingPercent === 20
)
const invalidPaddingV2 = parseEditDocument(JSON.stringify({
  ...restored,
  renderSettings: {
    backgroundEnabled: true,
    backgroundColor: '#16181D',
    backgroundPaddingPercent: null
  }
}))
check(
  'V2 背景边距非数值时回退 6%',
  invalidPaddingV2.renderSettings.backgroundPaddingPercent === 6
)

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))
let releaseFirst: (() => void) | null = null
const firstSave = new Promise<void>((resolve) => { releaseFirst = resolve })
const saveCalls: string[] = []
;(globalThis as unknown as { window: { api: { saveSessionEdit(id: string, json: string): Promise<{ updatedAt: number }> } } }).window = {
  api: {
    async saveSessionEdit(_id, json) {
      saveCalls.push(json)
      if (saveCalls.length === 1) await firstSave
      return { updatedAt: Date.now() }
    }
  }
}
let autosaveState = {
  current: {
    session: { sessionId: 'session-1', startedAt: 1 },
    timeline: { events, canvas, durationMs: 6000 },
    videoUrl: '', audioUrl: null, systemAudioUrl: null, systemAudioOffsetSec: 0
  },
  sessions: [{ sessionId: 'session-1', startedAt: 1 }],
  editRevision: 0,
  saveState: { kind: 'idle' as const },
  motionParams: DEFAULT_MOTION_PARAMS,
  motionEnabled: true,
  motionEffects: moved,
  manualKeyPrompts: [], hiddenRecordedKeyIndices: [], cuts: [],
  audioGain: { mic: 1, system: 1 }, audioMute: { mic: false, system: false },
  renderSettings: {
    backgroundEnabled: false,
    backgroundColor: '#16181D',
    backgroundPaddingPercent: 12
  }, customClips: [],
  keyboardOverlay: { x: 0.5, y: 0.86 }
} as unknown as PreviewState
const getAutosave = (): PreviewState => autosaveState
const setAutosave = (patch: Partial<PreviewState>): void => {
  autosaveState = { ...autosaveState, ...patch }
}
markEditDirty(getAutosave, setAutosave, 0)
await wait(10)
autosaveState.keyboardOverlay = { x: 0.8, y: 0.7 }
markEditDirty(getAutosave, setAutosave, 0)
await wait(10)
releaseFirst?.()
await wait(30)
const latestSaved = saveCalls.at(-1) ? JSON.parse(saveCalls.at(-1)!) as EditDocumentV2 : null
check(
  '保存中继续编辑最终落盘最新 revision',
  saveCalls.length === 2 && latestSaved?.keyboardOverlay.x === 0.8 &&
    latestSaved.renderSettings.backgroundPaddingPercent === 12 &&
    autosaveState.saveState.kind === 'saved'
)
resetEditAutosave()

console.log(failures === 0 ? '\n全部通过' : `\n${failures} 项失败`)
process.exit(failures === 0 ? 0 : 1)
