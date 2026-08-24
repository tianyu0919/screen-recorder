import type { RecordingEvents } from './types'

/**
 * events.json V2 契约（kr-01 window-capture-fixed-canvas）：
 * V2 在 V1 基础上增加 source（来源类型 + 固定画布 + 窗口几何时间线）。
 * 整屏录制仍写 V1；窗口录制写 V2。读取端一律经 normalizeRecordingEvents
 * 归一化为 V2 内存模型（V1 合成 screen 来源，原文件不被修改）。
 */

/** 窗口几何样本：[t, x, y, width, height]，屏幕坐标系（与全局输入事件一致），t 相对录制开始 ms */
export type WindowGeometrySample = [number, number, number, number, number]

export interface RecordingSource {
  type: 'screen' | 'window'
  /** desktopCapturer 源 id（screen:* / window:*） */
  id: string
  /** 录制期冻结的恒定视频画布（窗口录制取开始时所在显示器物理分辨率，偶数化） */
  fixedCanvas: { width: number; height: number }
  /** 窗口 bounds 动态采样（仅 window 来源；helper 不可用时缺省，渲染退回旧显示器换算） */
  windowGeometry?: WindowGeometrySample[]
}

export interface RecordingEventsV2 {
  version: 2
  startTime: number
  display: RecordingEvents['display']
  source: RecordingSource
  video: RecordingEvents['video']
  mouseTrack: RecordingEvents['mouseTrack']
  clicks: RecordingEvents['clicks']
  keys: RecordingEvents['keys']
}

export type AnyRecordingEvents = RecordingEvents | RecordingEventsV2

/** source 字段 schema 校验（V2 专用；由 types.ts 的 validateRecordingEvents 调用） */
export function validateRecordingSource(source: unknown): string[] {
  const errors: string[] = []
  const s = source as Partial<RecordingSource> | null
  if (s === null || typeof s !== 'object') return ['source 缺失或不是对象']
  if (s.type !== 'screen' && s.type !== 'window') errors.push('source.type 必须是 screen|window')
  if (typeof s.id !== 'string') errors.push('source.id 缺失或类型错误')
  const canvas = s.fixedCanvas
  if (
    !canvas ||
    typeof canvas.width !== 'number' ||
    typeof canvas.height !== 'number' ||
    !Number.isFinite(canvas.width) ||
    !Number.isFinite(canvas.height) ||
    canvas.width <= 0 ||
    canvas.height <= 0
  ) {
    errors.push('source.fixedCanvas{width,height} 缺失或非法')
  }
  if (s.windowGeometry !== undefined) {
    if (!Array.isArray(s.windowGeometry)) {
      errors.push('source.windowGeometry 必须是数组')
    } else if (!s.windowGeometry.every((g, index, all) => {
      if (!Array.isArray(g) || g.length !== 5) return false
      const [t, , , width, height] = g
      return g.every((n) => typeof n === 'number' && Number.isFinite(n)) &&
        t >= 0 && width > 0 && height > 0 &&
        (index === 0 || t >= all[index - 1][0])
    })) {
      errors.push('source.windowGeometry 元素必须是 [t, x, y, width, height] 数值五元组')
    }
  }
  return errors
}

/**
 * V1/V2 → 内部统一 V2 模型。V1 会话合成 screen 来源（fixedCanvas = 视频尺寸），
 * 只在内存中升级，不回写 events.json。
 */
export function normalizeRecordingEvents(events: AnyRecordingEvents): RecordingEventsV2 {
  if (events.version === 2) return events
  return {
    version: 2,
    startTime: events.startTime,
    display: events.display,
    source: {
      type: 'screen',
      id: '',
      fixedCanvas: { width: events.video.width, height: events.video.height }
    },
    video: events.video,
    mouseTrack: events.mouseTrack,
    clicks: events.clicks,
    keys: events.keys
  }
}
