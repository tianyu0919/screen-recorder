import type { CameraKeyframe, CameraState } from '@shared/types'
import type { RecordingEventsV2 } from '@shared/eventsV2'
import { clampCameraToCanvas } from './coords'
import type { CanvasSize } from './types'
import { screenPointToCanvas } from './windowGeometry'

/**
 * 自动关键帧生成器（Task 1.3）：
 * 遍历 clicks，点击前 leadMs 生成"缩放到点击区域"目标状态；
 * 无操作超过 returnThresholdMs 回归 1.0x 全景；点击间隔小于 dwellMs 不插回归帧
 * （密集点击直接过渡到下一个点击区域）。纯函数，无 DOM/时钟依赖，kr-03 导出可复用。
 */

/** 运镜规则参数（spec：目标倍率/停留时长/回归阈值均可配置） */
export interface MotionParams {
  /** 点击提前量（ms）：缩放关键帧提前出现，点击时刻画面已就位 */
  leadMs: number
  /** 目标缩放倍率 */
  targetZoom: number
  /** 停留时长（ms）：回归帧距点击的时间；点击间隔小于它则合并，不插回归帧 */
  dwellMs: number
  /** 回归阈值（ms）：与下一次点击的间隔超过它才回归 1.0x 全景 */
  returnThresholdMs: number
}

export const DEFAULT_MOTION_PARAMS: MotionParams = {
  leadMs: 200,
  targetZoom: 2,
  dwellMs: 1500,
  returnThresholdMs: 3000
}

/** 1.0x 全景状态（视口中心 = 画布中心） */
export function fullViewState(canvas: CanvasSize): CameraState {
  return { x: canvas.width / 2, y: canvas.height / 2, zoom: 1 }
}

/**
 * 由点击事件生成相机关键帧序列（按 t 升序，首帧恒为 t=0 全景）。
 * clicks 为空时仅返回全景帧 —— 钩子降级会话相机全程 1.0x。
 */
export function generateCameraKeyframes(
  events: RecordingEventsV2,
  canvas: CanvasSize,
  params: MotionParams = DEFAULT_MOTION_PARAMS
): CameraKeyframe[] {
  const full = fullViewState(canvas)
  const keyframes: CameraKeyframe[] = [{ t: 0, target: full }]
  // 窗口录制：当时刻窗口 bounds 之外的点击不产生运镜目标（screenPointToCanvas 返回 null）
  const clicks = [...events.clicks]
    .sort((a, b) => a.t - b.t)
    .flatMap((click) => {
      const point = screenPointToCanvas(events, click.t, click.x, click.y)
      return point ? [{ ...click, canvasPoint: point }] : []
    })

  for (let i = 0; i < clicks.length; i++) {
    const click = clicks[i]
    const point = click.canvasPoint
    const target = clampCameraToCanvas({ x: point.x, y: point.y, zoom: params.targetZoom }, canvas)
    keyframes.push({ t: Math.max(0, click.t - params.leadMs), target })

    const next = clicks[i + 1]
    const gap = next ? next.t - click.t : Infinity
    if (gap < params.dwellMs) continue // 密集点击合并：直接过渡到下一个点击区域
    if (gap <= params.returnThresholdMs) continue // 无操作未超回归阈值，保持现状
    keyframes.push({ t: click.t + params.dwellMs, target: full })
  }

  // 回归帧可能晚于下一次点击的缩放帧（dwell > gap - lead 时），统一按 t 排序；
  // 同一时刻的重复关键帧保留后者（后生成的目标优先）
  keyframes.sort((a, b) => a.t - b.t)
  return keyframes.filter((kf, i) => i === keyframes.length - 1 || kf.t !== keyframes[i + 1].t)
}
