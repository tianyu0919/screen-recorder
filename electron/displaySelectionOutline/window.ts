import { BrowserWindow, type Rectangle } from 'electron'

const OUTLINE_HTML = `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'" />
    <style>
      html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: transparent; }
      body {
        box-sizing: border-box;
        border: 6px solid #ff5c38;
        box-shadow: inset 0 0 18px rgba(255, 92, 56, 0.32);
      }
    </style>
  </head>
  <body></body>
</html>`

export interface OutlineWindowOptions {
  bounds: Rectangle
  visibleOnAllWorkspaces?: boolean
  skipTaskbar?: boolean
}

/** 创建只负责绘制内边框的透明覆盖窗口；平台文件决定空间/置顶策略。 */
export async function createOutlineWindow({
  bounds,
  visibleOnAllWorkspaces = false,
  skipTaskbar
}: OutlineWindowOptions): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    show: false,
    focusable: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    ...(skipTaskbar === undefined ? {} : { skipTaskbar }),
    hasShadow: false,
    roundedCorners: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.setIgnoreMouseEvents(true)
  win.setAlwaysOnTop(true, 'screen-saver')
  if (visibleOnAllWorkspaces) {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }
  await win.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(OUTLINE_HTML)}`)
  if (!win.isDestroyed()) win.showInactive()
  return win
}
