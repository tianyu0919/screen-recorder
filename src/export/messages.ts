import type { CameraKeyframe, ExportFormat } from '@shared/types'
import type { RipplePoint } from '../render/types'
import type { CutRange } from '../timeline/cuts'
import type { CanvasSize } from '../timeline/types'

/**
 * Renderer ↔ 导出 Worker 消息协议（Task 1.1）。
 * 取消不走消息：Renderer 直接 worker.terminate() 硬取消，
 * 输出全程在内存（ArrayBufferTarget），未完成前不落盘，天然无半成品。
 */

export type { ExportFormat }

/** Renderer → Worker：开始导出（导出参数取预览当前的 keyframes/ripples） */
export interface ExportStartMessage {
  type: 'start'
  sessionId: string
  keyframes: CameraKeyframe[]
  ripples: RipplePoint[]
  /** 裁剪区间（源时间轴 ms）：导出按"源时间轴 - 裁剪区间"的输出时间轴渲染 */
  cuts: CutRange[]
  /** 源视频分辨率（画布坐标系基准），供合成器 setCanvasSize */
  canvas: CanvasSize
  /** events.json 估计的时间轴长度（ms）；源视频 computeDuration 失败时的回退 */
  fallbackDurationMs: number
}

export interface ExportProgressMessage {
  type: 'progress'
  done: number
  total: number
}

export interface ExportDoneMessage {
  type: 'done'
  /** 封装完成的产物（transfer 给 Renderer 后弹保存对话框） */
  buffer: ArrayBuffer
  format: ExportFormat
  /** 是否含音轨（mic.wav 缺失或 AAC 编码不支持时为 false） */
  audio: boolean
  frames: number
  durationMs: number
}

export interface ExportErrorMessage {
  type: 'error'
  /** 友好错误提示（如"源视频无法解码"），不暴露原始堆栈 */
  message: string
}

export type ExportWorkerMessage = ExportProgressMessage | ExportDoneMessage | ExportErrorMessage
