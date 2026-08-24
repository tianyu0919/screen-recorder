import type {
  AnyRecordingEvents,
  RecordingEventsV2,
  WindowGeometrySample
} from '@shared/eventsV2'
import { fitRectCentered } from '@/lib/aspectFit'
import { displayToCanvas } from './coords'

/**
 * 窗口录制动态几何的坐标换算（kr-01 window-capture-fixed-canvas，Task 1.2）：
 * windowGeometry 样本与全局输入事件同属屏幕坐标系（DIP）。
 * 屏幕点 → 画布点：先求 t 时刻的窗口 bounds（相邻样本线性插值），
 * 再按"窗口内容在固定画布内等比居中"的 placement 映射；点在窗口外返回 null。
 * 无几何数据（screen 来源 / helper 降级）时退回 V1 显示器换算。
 */

/** t 时刻的窗口 bounds：相邻样本线性插值；范围外取端点样本。样本为空返回 null。 */
export function geometryAt(
  samples: WindowGeometrySample[],
  t: number
): { x: number; y: number; width: number; height: number } | null {
  if (samples.length === 0) return null
  const toRect = (s: WindowGeometrySample): { x: number; y: number; width: number; height: number } => ({
    x: s[1],
    y: s[2],
    width: s[3],
    height: s[4]
  })
  if (t <= samples[0][0]) return toRect(samples[0])
  const last = samples[samples.length - 1]
  if (t >= last[0]) return toRect(last)
  let lo = 0
  let hi = samples.length - 1
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1
    if (samples[mid][0] <= t) lo = mid
    else hi = mid
  }
  const a = samples[lo]
  const b = samples[hi]
  const span = b[0] - a[0]
  const k = span > 0 ? (t - a[0]) / span : 0
  return {
    x: a[1] + (b[1] - a[1]) * k,
    y: a[2] + (b[2] - a[2]) * k,
    width: a[3] + (b[3] - a[3]) * k,
    height: a[4] + (b[4] - a[4]) * k
  }
}

/** 是否为带几何时间线的窗口会话（否则走旧显示器换算） */
export function hasWindowGeometry(events: AnyRecordingEvents): events is RecordingEventsV2 {
  return (
    events.version === 2 &&
    events.source.type === 'window' &&
    Array.isArray(events.source.windowGeometry) &&
    events.source.windowGeometry.length > 0
  )
}

/**
 * 统一交互坐标映射（Task 1.2/1.3 唯一入口）：屏幕坐标 → 固定画布坐标。
 * 窗口会话：t 时刻窗口外的点返回 null（不生成波纹/运镜目标）。
 */
export function screenPointToCanvas(
  events: AnyRecordingEvents,
  t: number,
  screenX: number,
  screenY: number
): { x: number; y: number } | null {
  if (!hasWindowGeometry(events)) {
    return displayToCanvas(events.display, screenX, screenY)
  }
  const geometry = geometryAt(events.source.windowGeometry ?? [], t)
  if (!geometry || geometry.width <= 0 || geometry.height <= 0) return null
  if (
    screenX < geometry.x ||
    screenX > geometry.x + geometry.width ||
    screenY < geometry.y ||
    screenY > geometry.y + geometry.height
  ) {
    return null
  }
  const { fixedCanvas } = events.source
  const placement = fitRectCentered(
    fixedCanvas.width,
    fixedCanvas.height,
    geometry.width,
    geometry.height
  )
  if (placement.width <= 0 || placement.height <= 0) return null
  return {
    x: placement.x + ((screenX - geometry.x) / geometry.width) * placement.width,
    y: placement.y + ((screenY - geometry.y) / geometry.height) * placement.height
  }
}
