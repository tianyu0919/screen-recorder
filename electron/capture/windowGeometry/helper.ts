import { app } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { WindowGeometrySample } from '../../../shared/eventsV2'

/**
 * 窗口几何原生 helper 进程管理（kr-01 window-capture-fixed-canvas，darwin/win32 共用）：
 * 协议：spawn `<bin> <windowRef> <t0UnixMs>`；helper 以 ~60Hz 轮询窗口 bounds，
 * 变化时向 stdout 写一行 JSON：{"t":ms相对t0,"x","y","w","h"}（屏幕 DIP 坐标，
 * 与 uiohook/光标轮询同一坐标系）；几何不变时不重复输出。
 * 停止 = 关闭 stdin（EOF），2s 超时强杀兜底（与 systemAudio helper 同约定）。
 * helper 缺失/启动失败 → 返回 null，渲染端退回旧显示器换算，不阻断录制。
 * 平台差异（helper 二进制名/路径）由 darwin.ts / win32.ts 以 HelperSpec 传入。
 */

export interface GeometryHelperSpec {
  /** 打包后 resourcesPath 下的二进制名（win 带 .exe） */
  binName: string
  /** dev 环境项目内构建产物相对路径 */
  devBinPath: string
  /** 日志前缀 */
  tag: string
  /** helper 原始坐标到 Electron screen DIP 坐标的转换（Windows 混合 DPI 使用） */
  mapSample?: (sample: WindowGeometrySample) => WindowGeometrySample
}

export interface WindowGeometrySession {
  /** 首个有效 bounds（冻结画布前用于定位窗口所在显示器）；超时/失败为 null */
  firstSample(timeoutMs: number): Promise<WindowGeometrySample | null>
  /** 停止采样，返回去重后的几何时间线（按 t 升序） */
  stop(): Promise<WindowGeometrySample[]>
}

function helperBinPath(spec: GeometryHelperSpec): string | null {
  const path = app.isPackaged
    ? join(process.resourcesPath, spec.binName)
    : join(app.getAppPath(), spec.devBinPath)
  if (!existsSync(path)) {
    console.warn(`${spec.tag} helper 不存在: ${path}（需先 npm run build:native）`)
    return null
  }
  return path
}

function parseSample(line: string): WindowGeometrySample | null {
  try {
    const d = JSON.parse(line) as Record<string, unknown>
    const nums = [d.t, d.x, d.y, d.w, d.h]
    if (!nums.every((n) => typeof n === 'number' && Number.isFinite(n))) return null
    const [t, x, y, w, h] = nums as number[]
    // 非法尺寸（最小化零尺寸等）不落时间线，由渲染端沿用最近有效样本
    if (t < 0 || w <= 0 || h <= 0) return null
    return [t, x, y, w, h]
  } catch {
    return null
  }
}

export function spawnWindowGeometryHelper(
  spec: GeometryHelperSpec,
  windowRef: string,
  t0: number
): WindowGeometrySession | null {
  const bin = helperBinPath(spec)
  if (!bin) return null

  let child: ChildProcess
  try {
    child = spawn(bin, [windowRef, String(t0)], { stdio: ['pipe', 'pipe', 'pipe'] })
  } catch (err) {
    console.error(`${spec.tag} spawn 失败:`, err)
    return null
  }
  console.log(`${spec.tag} 已启动 pid=${child.pid} window=${windowRef}`)
  child.stderr?.on('data', (d: Buffer) => console.error(`${spec.tag} stderr: ${d.toString().trim()}`))

  const samples: WindowGeometrySample[] = []
  let stdoutBuf = ''
  let resolveFirst: ((s: WindowGeometrySample | null) => void) | null = null
  let firstSettled = false
  const settleFirst = (s: WindowGeometrySample | null): void => {
    if (firstSettled) return
    firstSettled = true
    resolveFirst?.(s)
  }

  child.stdout?.on('data', (d: Buffer) => {
    stdoutBuf += d.toString('utf8')
    let nl = stdoutBuf.indexOf('\n')
    while (nl >= 0) {
      const line = stdoutBuf.slice(0, nl).trim()
      stdoutBuf = stdoutBuf.slice(nl + 1)
      nl = stdoutBuf.indexOf('\n')
      if (!line) continue
      const parsed = parseSample(line)
      if (!parsed) continue
      const sample = spec.mapSample?.(parsed) ?? parsed
      // 静止去重；发生离散变化时补一个旧 bounds 的保持点，避免插值让窗口
      // 在整个静止区间内缓慢漂向新位置。
      const last = samples[samples.length - 1]
      if (last && last[1] === sample[1] && last[2] === sample[2] && last[3] === sample[3] && last[4] === sample[4]) {
        settleFirst(last)
        continue
      }
      if (last && sample[0] - last[0] > 1) {
        samples.push([sample[0] - 1, last[1], last[2], last[3], last[4]])
      }
      samples.push(sample)
      settleFirst(sample)
    }
  })

  let exited = false
  const exitPromise = new Promise<void>((resolve) => {
    child.on('exit', (code) => {
      exited = true
      console.log(`${spec.tag} 已退出 code=${code}`)
      settleFirst(null)
      resolve()
    })
    child.on('error', (err) => {
      exited = true
      console.error(`${spec.tag} 进程错误:`, err)
      settleFirst(null)
      resolve()
    })
  })

  return {
    firstSample(timeoutMs: number) {
      if (samples.length > 0) return Promise.resolve(samples[0])
      if (exited) return Promise.resolve(null)
      return new Promise((resolve) => {
        resolveFirst = resolve
        setTimeout(() => settleFirst(null), timeoutMs)
      })
    },
    async stop() {
      if (!exited) {
        child.stdin?.end()
        const timeout = new Promise<void>((resolve) => setTimeout(resolve, 2000))
        await Promise.race([exitPromise, timeout])
        if (!exited) {
          child.kill('SIGKILL')
          await exitPromise
        }
      }
      return samples
    }
  }
}
