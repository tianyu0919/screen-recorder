import type { WindowGeometrySession } from './helper'
import { startWindowGeometry as startDarwin } from './darwin'
import { startWindowGeometry as startWin32 } from './win32'

export type { WindowGeometrySession }

/**
 * 窗口几何采样平台分发（只放分发逻辑）：
 * darwin → CoreGraphics/ScreenCaptureKit Swift helper；win32 → DWM/Win32 Rust helper。
 * sourceId 形如 "window:123:0"，数字段即 CGWindowID / HWND。
 * 非窗口来源、平台不支持或 helper 不可用 → 返回 null，录制继续（渲染端降级）。
 */
export function startWindowGeometryCapture(
  sourceId: string,
  t0: number
): WindowGeometrySession | null {
  if (!sourceId.startsWith('window')) return null
  const windowRef = sourceId.split(':')[1]
  if (!windowRef) return null
  if (process.platform === 'darwin') return startDarwin(windowRef, t0)
  if (process.platform === 'win32') return startWin32(windowRef, t0)
  return null
}
