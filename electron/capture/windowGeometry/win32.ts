import { screen } from 'electron'
import { spawnWindowGeometryHelper, type WindowGeometrySession } from './helper'

/**
 * Windows 窗口几何采样：spawn Rust helper（native/window-geometry/win32），
 * 按 HWND（desktopCapturer window id 的数字段）轮询 DWM 扩展框架 bounds，
 * helper 输出物理像素；Main 用 Electron 的 screenToDipRect 转成全局 DIP，避免
 * 混合 DPI 多屏下直接除目标窗口 scaleFactor 导致全局原点错位。
 * helper 不存在 / 启动失败 → 返回 null 静默降级（旧显示器换算）。
 */
export function startWindowGeometry(windowRef: string, t0: number): WindowGeometrySession | null {
  return spawnWindowGeometryHelper(
    {
      binName: 'window-geometry.exe',
      devBinPath: 'native/window-geometry/win32/bin/window-geometry.exe',
      tag: '[window-geometry]',
      mapSample: ([t, x, y, width, height]) => {
        const rect = screen.screenToDipRect(null, { x, y, width, height })
        return [t, rect.x, rect.y, rect.width, rect.height]
      }
    },
    windowRef,
    t0
  )
}
