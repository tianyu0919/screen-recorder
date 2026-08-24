import type { BrowserWindow, Display } from 'electron'
import { createOutlineWindow } from './window'

/** Windows：skipTaskbar + focusable:false 保证不进入任务栏/Alt+Tab 且不抢占输入。 */
export function createDisplaySelectionOutline(display: Display): Promise<BrowserWindow> {
  return createOutlineWindow({ bounds: display.bounds, skipTaskbar: true })
}
