import type { BrowserWindow, Display } from 'electron'
import { createOutlineWindow } from './window'

/** macOS：避免任务栏及跨 Space API，它们会转换整个应用的进程类型并隐藏 Dock/⌘Tab。 */
export async function createDisplaySelectionOutline(display: Display): Promise<BrowserWindow> {
  const win = await createOutlineWindow({
    bounds: display.bounds
  })
  win.setHiddenInMissionControl(true)
  win.excludedFromShownWindowsMenu = true
  win.setWindowButtonVisibility(false)
  return win
}
