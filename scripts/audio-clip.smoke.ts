import type { RecordingEvents } from '../shared/types'
import { slicePcm, type WavData } from '../src/export/audio'
import {
  audioClipDurationMs,
  audioClipPlaybackWindow,
  clampAudioClipToTimeline,
  type CustomClip,
  updateAudioClipRange
} from '../src/lib/audioClip'
import { deriveTimelineEffects, eventsWithinDuration } from '../src/timeline/derive'
import { DEFAULT_MOTION_PARAMS } from '../src/timeline/keyframes'

let failures = 0
function check(name: string, condition: boolean): void {
  if (condition) console.log(`ok   ${name}`)
  else {
    failures++
    console.error(`FAIL ${name}`)
  }
}

const events: RecordingEvents = {
  version: 1,
  startTime: 0,
  display: { id: 1, bounds: [0, 0, 1920, 1080], scaleFactor: 1 },
  video: { width: 1920, height: 1080, fps: 60, file: 'screen.webm' },
  mouseTrack: [[27_970, 1, 1]],
  clicks: [{ t: 27_605, x: 100, y: 100, button: 1 }],
  keys: [{ t: 26_000, key: 'Enter' }]
}
const bounded = eventsWithinDuration(events, 27_000)
check('真实片尾外事件被过滤', bounded.clicks.length === 0 && bounded.mouseTrack.length === 0)
const effects = deriveTimelineEffects(
  { events, canvas: { width: 1920, height: 1080 }, durationMs: 27_970 },
  DEFAULT_MOTION_PARAMS,
  {},
  27_000
)
check(
  '片尾外点击不生成提前缩放或波纹',
  effects.ripples.length === 0 && effects.keyframes.every((keyframe) => keyframe.target.zoom === 1)
)

const clip: CustomClip = {
  id: 'clip',
  name: 'bgm.wav',
  offsetMs: 0,
  gain: 1,
  sourceDurationMs: 60_000,
  trimStartMs: 0,
  trimEndMs: 60_000,
  peaks: []
}
const clamped = clampAudioClipToTimeline(clip, 27_000)
check('长音频导入后截到片尾', audioClipDurationMs(clamped) === 27_000)
const scheduledClip = clampAudioClipToTimeline({ ...clamped, offsetMs: 2_000 }, 27_000)
const beforeClip = audioClipPlaybackWindow(scheduledClip, 500)
check(
  '播放头在 clip 前只安排边界启动',
  beforeClip?.waitMs === 1_500 && beforeClip.sourceMs === 0 && beforeClip.playMs === 25_000
)
const insideClip = audioClipPlaybackWindow(scheduledClip, 3_500)
check(
  '播放头在 clip 内只计算一次源位置和剩余时长',
  insideClip?.waitMs === 0 && insideClip.sourceMs === 1_500 && insideClip.playMs === 23_500
)
check(
  '播放头越过 clip 后不再调度',
  audioClipPlaybackWindow(scheduledClip, 27_000) === null
)
const trimmed = updateAudioClipRange(
  { ...clip, trimEndMs: 10_000 },
  { offsetMs: 1_000, trimStartMs: 1_000 },
  27_000
)
check(
  '左侧裁剪同时移动时间轴起点',
  trimmed.offsetMs === 1_000 && trimmed.trimStartMs === 1_000 && audioClipDurationMs(trimmed) === 9_000
)

const wav: WavData = {
  sampleRate: 1_000,
  channels: 1,
  samples: new Int16Array(10_000).map((_, index) => index)
}
const pcm = slicePcm(wav, 1_000, 4_000)
check('导出 PCM 使用相同裁剪区间', pcm.samples.length === 3_000 && pcm.samples[0] === 1_000)

console.log(failures === 0 ? '\n全部通过' : `\n${failures} 项失败`)
process.exit(failures === 0 ? 0 : 1)
