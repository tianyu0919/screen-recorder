/**
 * e2e 主进程（高保真）：复用正式应用的 registerMediaProtocol（手写 206 Range 同一份代码），
 * 会话文件拷入临时 userData/recordings/e2e/，协议语义与生产完全一致。
 * 内嵌 http server 提供页面（localhost = 安全上下文，WebCodecs 可用）。
 *
 * 用法（从项目根）：
 *   npx esbuild scripts/e2e/entry.ts --bundle --format=esm --alias:@shared=./shared --outfile=scripts/e2e/out/page.js
 *   npx esbuild scripts/e2e/worker-entry.ts --bundle --format=esm --alias:@shared=./shared --outfile=scripts/e2e/out/worker.js
 *   npx esbuild scripts/e2e/main-entry.ts --bundle --format=esm --platform=node --external:electron --outfile=scripts/e2e/out/e2e-main.mjs
 *   npx electron scripts/e2e/out/e2e-main.mjs <会话目录绝对路径>
 * 成功时末行输出 JSON：verify.samples 各时间点哈希不同即画面逐帧推进。
 */
import { app, BrowserWindow, protocol } from 'electron'
import { createServer } from 'node:http'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerMediaProtocol } from '../../electron/store/sessionReader'

const sessionDir = process.argv[2]
if (!sessionDir) {
  console.error('usage: electron scripts/e2e/out/e2e-main.mjs <abs session dir>')
  process.exit(1)
}
const sessionAbs = resolve(sessionDir)
const here = fileURLToPath(new URL('.', import.meta.url))
const pageDir = join(here, '..')

const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript' }
const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  const file = join(pageDir, url.pathname === '/' ? 'page.html' : url.pathname)
  readFile(file)
    .then((data) => {
      const ext = file.slice(file.lastIndexOf('.'))
      res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' })
      res.end(data)
    })
    .catch(() => {
      res.writeHead(404)
      res.end('not found')
    })
})

const userData = mkdtempSync(join(tmpdir(), 'sr-e2e-'))
app.setPath('userData', userData)
app.commandLine.appendSwitch('no-sandbox')

// 与 electron/main/index.ts 一致：ready 前注册 media:// 特权
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true }
  }
])

app.whenReady().then(async () => {
  // 会话落盘到 userData/recordings/e2e/，registerMediaProtocol 的 recordingsRoot 即指向它
  const target = join(userData, 'recordings', 'e2e')
  mkdirSync(target, { recursive: true })
  for (const f of ['screen.webm', 'mic.wav', 'events.json']) {
    if (existsSync(join(sessionAbs, f))) copyFileSync(join(sessionAbs, f), join(target, f))
  }
  registerMediaProtocol()

  await new Promise((res) => server.listen(0, '127.0.0.1', res))
  const port = (server.address() as { port: number }).port
  console.log('[e2e] serving on', port)

  const win = new BrowserWindow({ show: false, width: 640, height: 400 })
  win.on('closed', () => console.log('[e2e] window closed'))
  app.on('window-all-closed', () => console.log('[e2e] window-all-closed'))
  app.on('before-quit', () => console.log('[e2e] before-quit'))
  app.on('child-process-gone', (_e, details) =>
    console.log('[e2e] child-process-gone:', JSON.stringify(details))
  )
  win.webContents.on('console-message', (_e, _level, msg) => {
    if (msg.startsWith('E2E_RESULT ')) {
      console.log(msg.slice('E2E_RESULT '.length))
      app.quit()
      process.exit(0)
    } else {
      console.log('[page]', msg)
    }
  })
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('renderer gone:', JSON.stringify(details))
    process.exit(2)
  })
  await win.loadURL(`http://127.0.0.1:${port}/page.html`)

  setTimeout(() => {
    console.error('E2E 总超时 600s')
    process.exit(3)
  }, 600_000)
})
