/** 自定义音轨在时间轴上的非破坏性裁剪模型。 */
export interface CustomClip {
  id: string
  name: string
  /** clip 在视频源时间轴上的起点。 */
  offsetMs: number
  gain: number
  /** 原音频总时长与当前保留区间。 */
  sourceDurationMs: number
  trimStartMs: number
  trimEndMs: number
  peaks: number[]
  /** 会话目录内持久化资产相对路径；尚未保存的导入可为空。 */
  assetFile?: string
}

export const MIN_AUDIO_CLIP_MS = 100

export interface AudioClipPlaybackWindow {
  /** 距离 clip 开始还需等待的源时间轴时长。 */
  waitMs: number
  /** 预览音频源应从原文件的哪个位置开始。 */
  sourceMs: number
  /** 从开始位置到 clip 结尾还能播放多久。 */
  playMs: number
}

/** 计算一次播放/seek 后的 clip 边界调度，不参与逐帧路径。 */
export function audioClipPlaybackWindow(
  clip: CustomClip,
  timelineMs: number
): AudioClipPlaybackWindow | null {
  if (!Number.isFinite(timelineMs)) return null
  const durationMs = audioClipDurationMs(clip)
  const localMs = timelineMs - clip.offsetMs
  if (durationMs <= 0 || localMs >= durationMs) return null
  if (localMs < 0) {
    return { waitMs: -localMs, sourceMs: clip.trimStartMs, playMs: durationMs }
  }
  return {
    waitMs: 0,
    sourceMs: clip.trimStartMs + localMs,
    playMs: durationMs - localMs
  }
}

export function audioClipDurationMs(clip: CustomClip): number {
  return Math.max(0, clip.trimEndMs - clip.trimStartMs)
}

/** 视频真实时长变短或长音频刚导入时，把 clip 非破坏性钳制在片尾内。 */
export function clampAudioClipToTimeline(clip: CustomClip, durationMs: number): CustomClip {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return clip
  const sourceDurationMs = Math.max(0, clip.sourceDurationMs)
  const trimStartMs = Math.min(Math.max(0, clip.trimStartMs), sourceDurationMs)
  const sourceRemaining = Math.max(0, sourceDurationMs - trimStartMs)
  const wantedDuration = Math.min(
    Math.max(0, clip.trimEndMs - trimStartMs),
    sourceRemaining,
    durationMs
  )
  const minVisible = Math.min(MIN_AUDIO_CLIP_MS, wantedDuration, durationMs)
  const offsetMs = Math.min(Math.max(0, clip.offsetMs), Math.max(0, durationMs - minVisible))
  const available = Math.max(0, durationMs - offsetMs)
  const clipDuration = Math.min(wantedDuration, available)
  return {
    ...clip,
    offsetMs,
    trimStartMs,
    trimEndMs: trimStartMs + clipDuration
  }
}

export function updateAudioClipRange(
  clip: CustomClip,
  patch: Partial<Pick<CustomClip, 'offsetMs' | 'trimStartMs' | 'trimEndMs'>>,
  timelineDurationMs: number
): CustomClip {
  const trimStartMs = Math.min(
    Math.max(0, patch.trimStartMs ?? clip.trimStartMs),
    clip.trimEndMs - Math.min(MIN_AUDIO_CLIP_MS, clip.trimEndMs)
  )
  const trimEndMs = Math.max(
    Math.min(clip.sourceDurationMs, patch.trimEndMs ?? clip.trimEndMs),
    trimStartMs + Math.min(MIN_AUDIO_CLIP_MS, clip.sourceDurationMs - trimStartMs)
  )
  return clampAudioClipToTimeline(
    { ...clip, ...patch, trimStartMs, trimEndMs },
    timelineDurationMs
  )
}
