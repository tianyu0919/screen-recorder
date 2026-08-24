import { spawnWindowGeometryHelper, type WindowGeometrySession } from './helper'

/**
 * macOS 窗口几何采样：spawn Swift helper（native/window-geometry/darwin），
 * 按 CGWindowID（desktopCapturer window id 的数字段）轮询 CoreGraphics 窗口 bounds。
 * helper 不存在 / 启动失败 → 返回 null 静默降级（旧显示器换算）。
 */
export function startWindowGeometry(windowRef: string, t0: number): WindowGeometrySession | null {
  return spawnWindowGeometryHelper(
    {
      binName: 'window-geometry',
      devBinPath: 'native/window-geometry/darwin/bin/window-geometry',
      tag: '[window-geometry]'
    },
    windowRef,
    t0
  )
}
