import type { CameraKeyframe, CameraState } from '@shared/types'
import { clampCameraToCanvas } from './coords'
import { fullViewState } from './keyframes'
import type { CanvasSize } from './types'

/**
 * spring 阻尼插值求值器（Task 1.4）：
 * 二阶弹簧（加速度 = -stiffness·位移 - damping·速度）+ RK4 定步长积分。
 * 关键帧只切换目标状态，位置/速度全程连续 —— 运镜中途改目标无跳变。
 * 纯模块：不依赖 DOM / 实时时钟 / video 元素，预览与 kr-03 Worker 导出共用。
 */

/** spring 物理参数（质量恒为 1，时间单位秒） */
export interface SpringParams {
  stiffness: number
  damping: number
}

/**
 * 默认曲线：轻微欠阻尼（ζ≈0.84），有"肉感"且 ~300ms 内收敛 ——
 * 配合 leadMs=200 保证点击时刻画面已基本就位。
 */
export const DEFAULT_SPRING: SpringParams = { stiffness: 240, damping: 26 }

/** RK4 积分步长（ms）：1ms 下 ω=√150 远小于稳定域上限 */
const DT_MS = 1

interface Vec3 {
  x: number
  y: number
  zoom: number
}

/** 单通道 spring 加速度 */
function accel(pos: number, vel: number, target: number, s: SpringParams): number {
  return -s.stiffness * (pos - target) - s.damping * vel
}

/** RK4 单步推进单通道（dt 单位秒），返回 [新位置, 新速度] */
function rk4Channel(
  pos: number,
  vel: number,
  target: number,
  s: SpringParams,
  dt: number
): [number, number] {
  const k1p = vel
  const k1v = accel(pos, vel, target, s)
  const k2p = vel + (k1v * dt) / 2
  const k2v = accel(pos + (k1p * dt) / 2, vel + (k1v * dt) / 2, target, s)
  const k3p = vel + (k2v * dt) / 2
  const k3v = accel(pos + (k2p * dt) / 2, vel + (k2v * dt) / 2, target, s)
  const k4p = vel + k3v * dt
  const k4v = accel(pos + k3p * dt, vel + k3v * dt, target, s)
  return [
    pos + (dt / 6) * (k1p + 2 * k2p + 2 * k3p + k4p),
    vel + (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v)
  ]
}

/** 从 fromMs 积分到 toMs（目标状态不变），位置/速度原地更新 */
function advance(
  pos: Vec3,
  vel: Vec3,
  fromMs: number,
  toMs: number,
  target: CameraState,
  s: SpringParams
): void {
  let t = fromMs
  while (t < toMs) {
    const dt = Math.min(DT_MS, toMs - t) / 1000
    ;[pos.x, vel.x] = rk4Channel(pos.x, vel.x, target.x, s, dt)
    ;[pos.y, vel.y] = rk4Channel(pos.y, vel.y, target.y, s, dt)
    ;[pos.zoom, vel.zoom] = rk4Channel(pos.zoom, vel.zoom, target.zoom, s, dt)
    t += dt * 1000
  }
}

interface SimState {
  pos: Vec3
  vel: Vec3
  /** 当前已积分到的时间（ms） */
  time: number
  /** 下一个待生效的关键帧下标 */
  nextKf: number
}

function initialSimState(canvas: CanvasSize): SimState {
  const full = fullViewState(canvas)
  return { pos: { ...full }, vel: { x: 0, y: 0, zoom: 0 }, time: 0, nextKf: 0 }
}

/** 推进仿真到 tMs：途中穿越的关键帧依次切换目标（用关键帧自带 spring 覆盖默认） */
function simulateTo(
  sim: SimState,
  keyframes: CameraKeyframe[],
  tMs: number,
  fallback: SpringParams
): void {
  while (sim.nextKf < keyframes.length && keyframes[sim.nextKf].t <= tMs) {
    const kf = keyframes[sim.nextKf]
    if (kf.t > sim.time) {
      const prev = keyframes[sim.nextKf - 1]
      const s = prev?.spring ?? fallback
      advance(sim.pos, sim.vel, sim.time, kf.t, prev?.target ?? sim.pos, s)
      sim.time = kf.t
    }
    sim.nextKf++
  }
  if (tMs > sim.time) {
    const active = keyframes[sim.nextKf - 1]
    advance(sim.pos, sim.vel, sim.time, tMs, active?.target ?? sim.pos, active?.spring ?? fallback)
    sim.time = tMs
  }
}

/**
 * 任意时间点采样相机状态（确定性纯函数：从 t=0 重放到 tMs）。
 * 返回钳制在画布内的状态；keyframes 为空或 tMs 早于首帧时保持 1.0x 全景。
 * 实时播放场景请用 createCameraAnimator（增量积分，避免每次从头重放）。
 */
export function sampleCameraAt(
  keyframes: CameraKeyframe[],
  canvas: CanvasSize,
  tMs: number,
  spring: SpringParams = DEFAULT_SPRING
): CameraState {
  const sorted = [...keyframes].sort((a, b) => a.t - b.t)
  const sim = initialSimState(canvas)
  simulateTo(sim, sorted, Math.max(0, tMs), spring)
  return clampCameraToCanvas({ ...sim.pos }, canvas)
}

/**
 * 增量相机动画器：实时播放（rVFC 驱动）每帧调 step(dtMs) 前进，
 * seek 时调 reset(tMs) 重新定位。状态确定性，与 sampleCameraAt 结果一致。
 */
export function createCameraAnimator(
  keyframes: CameraKeyframe[],
  canvas: CanvasSize,
  spring: SpringParams = DEFAULT_SPRING
): {
  step(dtMs: number): CameraState
  reset(tMs?: number): CameraState
  sample(): CameraState
} {
  const sorted = [...keyframes].sort((a, b) => a.t - b.t)
  let sim = initialSimState(canvas)

  function sample(): CameraState {
    return clampCameraToCanvas({ ...sim.pos }, canvas)
  }

  return {
    step(dtMs) {
      if (dtMs > 0) simulateTo(sim, sorted, sim.time + dtMs, spring)
      return sample()
    },
    reset(tMs = 0) {
      sim = initialSimState(canvas)
      simulateTo(sim, sorted, Math.max(0, tMs), spring)
      return sample()
    },
    sample
  }
}
