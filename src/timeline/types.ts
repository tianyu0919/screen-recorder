import type { RecordingEventsV2 } from '@shared/eventsV2'
import { normalizeRecordingEvents } from '@shared/eventsV2'
import { validateRecordingEvents } from '@shared/types'

/**
 * 时间线数据模型（Task 1.1）：
 * 内存态只持有事件流 + 画布尺寸，关键帧由 keyframes.ts 按参数即时生成。
 * CameraState / CameraKeyframe 契约类型定义在 shared/types.ts，此处不重复定义。
 */

/** 画布尺寸 = 视频分辨率（物理像素），坐标换算与边缘钳制的基准 */
export interface CanvasSize {
  width: number
  height: number
}

/** 内存时间线模型 */
export interface Timeline {
  /** 内部统一 V2 模型（V1 会话加载时归一化升级，原文件不变） */
  events: RecordingEventsV2
  canvas: CanvasSize
  /**
   * 事件时间轴长度估计（ms）。
   * events.json 不含视频时长，真实时长以预览期 video 元数据为准（Phase 3）。
   */
  durationMs: number
}

/** 会话数据损坏或不兼容（UI 捕获后友好提示，不暴露原始堆栈） */
export class TimelineParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TimelineParseError'
  }
}

/** 校验 events.json 数据并构建时间线模型（V1 归一化为 V2）；失败抛 TimelineParseError */
export function buildTimeline(data: unknown): Timeline {
  const errors = validateRecordingEvents(data)
  if (errors.length > 0) {
    throw new TimelineParseError(`会话数据损坏或不兼容: ${errors.join('；')}`)
  }
  const events = normalizeRecordingEvents(data as Parameters<typeof normalizeRecordingEvents>[0])
  return {
    events,
    canvas: { width: events.video.width, height: events.video.height },
    durationMs: estimateDuration(events)
  }
}

/** 解析 events.json 文本；JSON 语法错误与 schema 错误统一为 TimelineParseError */
export function parseEventsJson(json: string): Timeline {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new TimelineParseError('会话数据损坏或不兼容: events.json 不是合法 JSON')
  }
  return buildTimeline(data)
}

/** 以最后一条事件的时间戳估计时间轴长度 */
function estimateDuration(events: RecordingEventsV2): number {
  let max = 0
  const track = events.mouseTrack
  if (track.length > 0) max = Math.max(max, track[track.length - 1][0])
  for (const c of events.clicks) max = Math.max(max, c.t)
  for (const k of events.keys) max = Math.max(max, k.t)
  return max
}
