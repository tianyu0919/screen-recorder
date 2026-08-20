import type { CameraState } from '@shared/types'
import type { CanvasSize } from '../timeline/types'
import type { OutputSize, RippleParams, RipplePoint } from './types'

/**
 * 合成器纯数学层：布局、相机仿射变换、波纹时间求值、纹理降采样计算。
 * 无 GL / DOM / 时钟依赖，全部确定性纯函数，供 scripts/render.smoke.ts 程序化验证。
 *
 * 坐标系约定：画布坐标 = 视频物理像素，原点左上；输出坐标 = 输出画布像素，原点左上。
 */

/** 输出空间中的矩形（像素，左上原点） */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** 相机仿射变换（等比缩放 + 平移）：output = canvas * scale + offset */
export interface CameraTransform {
  scale: number
  offsetX: number
  offsetY: number
}

/** 单个活动波纹（输出空间） */
export interface ActiveRipple {
  x: number
  y: number
  radius: number
  alpha: number
}

/**
 * 视频在输出画布上的基准摆放（zoom=1、相机全景居中）：
 * 四周留白 paddingRatio × 输出短边，视频等比缩放居中放入剩余区域。
 */
export function computeBasePlacement(
  canvas: CanvasSize,
  output: OutputSize,
  paddingRatio: number
): Rect {
  const pad = Math.min(output.width, output.height) * Math.max(0, paddingRatio)
  const innerW = output.width - pad * 2
  const innerH = output.height - pad * 2
  const scale = Math.min(innerW / canvas.width, innerH / canvas.height)
  const width = canvas.width * scale
  const height = canvas.height * scale
  return {
    x: (output.width - width) / 2,
    y: (output.height - height) / 2,
    width,
    height
  }
}

/**
 * 相机状态 → 画布到输出画布的仿射变换。
 * 语义：output = outCenter + (canvasPt - camera) · baseScale · zoom ——
 * 被相机对准的画布点映射到输出画布中心，画面以该点为中心放大 zoom 倍；
 * zoom=1 且相机居中时退化为基准摆放（placement 的居中偏移在展开式中抵消）。
 */
export function cameraToOutputTransform(
  camera: CameraState,
  canvas: CanvasSize,
  placement: Rect,
  output: OutputSize
): CameraTransform {
  const baseScale = placement.width / canvas.width
  const scale = baseScale * camera.zoom
  return {
    scale,
    offsetX: output.width / 2 - camera.x * scale,
    offsetY: output.height / 2 - camera.y * scale
  }
}

/** 画布点 → 输出点 */
export function transformPoint(
  t: CameraTransform,
  x: number,
  y: number
): { x: number; y: number } {
  return { x: x * t.scale + t.offsetX, y: y * t.scale + t.offsetY }
}

/**
 * 单波纹在触发后 elapsedMs 时刻的形态。
 * 半径 easeOutCubic 快出缓收，alpha 线性淡出；不在 [0, durationMs] 内返回 null。
 */
export function rippleStateAt(
  elapsedMs: number,
  params: RippleParams
): { radius: number; alpha: number } | null {
  if (elapsedMs < 0 || elapsedMs > params.durationMs || params.durationMs <= 0) return null
  const p = elapsedMs / params.durationMs
  const ease = 1 - Math.pow(1 - p, 3)
  return { radius: params.maxRadius * ease, alpha: params.color[3] * (1 - p) }
}

/**
 * tMs 时刻的活动波纹列表：过滤时间窗内的触发点并映射到输出坐标。
 * 超出 maxCount 时保留最新的（触发时间靠后的）。
 */
export function activeRipplesAt(
  clicks: readonly RipplePoint[],
  tMs: number,
  params: RippleParams,
  transform: CameraTransform,
  maxCount: number
): ActiveRipple[] {
  const active: ActiveRipple[] = []
  for (const c of clicks) {
    const state = rippleStateAt(tMs - c.t, params)
    if (!state) continue
    const p = transformPoint(transform, c.x, c.y)
    active.push({ x: p.x, y: p.y, radius: state.radius, alpha: state.alpha })
  }
  return active.slice(-Math.max(0, maxCount))
}

/**
 * 纹理降采样计算（Task 2.4）：源尺寸任一维超过 limit 时等比缩小到上限内。
 * 返回目标尺寸与降采样倍率（1 = 不需要降采样）。
 */
export function fitTextureSize(
  width: number,
  height: number,
  limit: number
): { width: number; height: number; scale: number } {
  const maxDim = Math.max(width, height)
  if (maxDim <= limit) return { width, height, scale: 1 }
  const scale = limit / maxDim
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
    scale
  }
}
