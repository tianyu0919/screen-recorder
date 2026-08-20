import { app } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { unlink } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * macOS 系统音频采集（kr-01 system-audio）：
 * getDisplayMedia loopback 在 macOS 上是坏的（electron#52738：音轨出生即 ended、电平恒 0），
 * 改 spawn Swift helper（native/sck-audio）走 ScreenCaptureKit 全系统音频回采，落盘 WAV。
 * helper 不存在 / 启动失败 → 返回 null 静默降级（不阻断录制）。
 */

export type StopSystemAudio = () => Promise<void>

const TAG = '[sck-audio]'

/** helper 路径：打包后 resourcesPath/sck-audio，dev 用项目内构建产物 */
function helperBinPath(): string | null {
  const path = app.isPackaged
    ? join(process.resourcesPath, 'sck-audio')
    : join(app.getAppPath(), 'native', 'sck-audio', 'bin', 'sck-audio')
  if (!existsSync(path)) {
    console.warn(`${TAG} helper 不存在: ${path}（需先 npm run build:native）`)
    return null
  }
  return path
}

/**
 * 启动采集，返回停止函数（关闭 stdin 通知 helper patch WAV header 后退出；
 * 2s 超时 SIGKILL 兜底）。启动即失败（无 TCC 权限等）时 helper 会自行非零退出，
 * 此处清掉残留的 header-only WAV。
 * 注：不用 SIGTERM 做主通道——实测 DispatchSourceSignal 在挂了 SCStream 的进程里不触发。
 */
export function startSystemAudioCapture(wavPath: string): StopSystemAudio | null {
  const bin = helperBinPath()
  if (!bin) return null

  let child: ChildProcess
  try {
    child = spawn(bin, [wavPath], { stdio: ['pipe', 'pipe', 'pipe'] })
  } catch (err) {
    console.error(`${TAG} spawn 失败:`, err)
    return null
  }

  console.log(`${TAG} 已启动 pid=${child.pid} → ${wavPath}`)
  child.stderr?.on('data', (d: Buffer) => console.error(`${TAG} stderr: ${d.toString().trim()}`))

  let exited = false
  let exitCode: number | null = null
  const exitPromise = new Promise<void>((resolve) => {
    child.on('exit', (code) => {
      exited = true
      exitCode = code
      console.log(`${TAG} 已退出 code=${code}`)
      resolve()
    })
    child.on('error', (err) => {
      exited = true
      exitCode = -1
      console.error(`${TAG} 进程错误:`, err)
      resolve()
    })
  })
  // 启动失败（提前退出且非信号停止）：删除 header-only 的 system.wav，避免被当成有效音轨
  void exitPromise.then(() => {
    if (exitCode !== 0) void unlink(wavPath).catch(() => {})
  })

  return async () => {
    if (exited) return
    child.stdin?.end()
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 2000))
    await Promise.race([exitPromise, timeout])
    if (!exited) {
      child.kill('SIGKILL')
      await exitPromise
    }
  }
}
