import { app } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { unlink } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * 系统音频原生 helper 进程管理（kr-01 system-audio，darwin/win32 共用，平台无关）：
 * helper 协议：spawn `<bin> <wavPath>`；停止 = 关闭 stdin（EOF）通知 helper patch WAV
 * header 后退出，2s 超时强杀兜底；启动即失败（非零退出）时清掉 header-only 残留 WAV，
 * 避免被当成有效音轨。
 * 注：不用 SIGTERM 做主通道——macOS 实测 DispatchSourceSignal 在挂了 SCStream 的进程里
 * 不触发；stdin EOF 在父进程意外死亡时也会断开，helper 不会泄漏成孤儿。
 * 平台差异（helper 二进制名/路径）由 darwin.ts / win32.ts 以 HelperSpec 传入。
 */

export type StopSystemAudio = () => Promise<void>

export interface HelperSpec {
  /** 打包后 resourcesPath 下的二进制名（win 带 .exe） */
  binName: string
  /** dev 环境项目内构建产物相对路径（如 native/sck-audio/bin/sck-audio） */
  devBinPath: string
  /** 日志前缀 */
  tag: string
}

/** helper 路径：打包后 resourcesPath/<binName>，dev 用项目内构建产物 */
function helperBinPath(spec: HelperSpec): string | null {
  const path = app.isPackaged
    ? join(process.resourcesPath, spec.binName)
    : join(app.getAppPath(), spec.devBinPath)
  if (!existsSync(path)) {
    console.warn(`${spec.tag} helper 不存在: ${path}（需先 npm run build:native）`)
    return null
  }
  return path
}

/** 启动采集，返回停止函数；helper 不存在 / 启动失败 → 返回 null 静默降级（不阻断录制） */
export function spawnSystemAudioHelper(spec: HelperSpec, wavPath: string): StopSystemAudio | null {
  const bin = helperBinPath(spec)
  if (!bin) return null

  let child: ChildProcess
  try {
    child = spawn(bin, [wavPath], { stdio: ['pipe', 'pipe', 'pipe'] })
  } catch (err) {
    console.error(`${spec.tag} spawn 失败:`, err)
    return null
  }

  console.log(`${spec.tag} 已启动 pid=${child.pid} → ${wavPath}`)
  child.stderr?.on('data', (d: Buffer) => console.error(`${spec.tag} stderr: ${d.toString().trim()}`))

  let exited = false
  let exitCode: number | null = null
  const exitPromise = new Promise<void>((resolve) => {
    child.on('exit', (code) => {
      exited = true
      exitCode = code
      console.log(`${spec.tag} 已退出 code=${code}`)
      resolve()
    })
    child.on('error', (err) => {
      exited = true
      exitCode = -1
      console.error(`${spec.tag} 进程错误:`, err)
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
