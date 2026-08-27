import { app } from 'electron'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { ResolvedTtsModel } from './modelManager'

/**
 * TTS 原生 helper 会话封装（kr-08-tts-dubbing）。
 * 协议：启动加载模型后 stdout 第一行 {"ready":true,...}；
 * 之后 stdin 逐行 JSON 任务 {"text","sid","speed","out"}，每段 stdout 回一行结果；
 * {"cmd":"quit"} 或 stdin EOF 退出。平台分发在 index.ts，路径配置在 darwin.ts/win32.ts。
 */

export interface PlatformTtsHelperConfig {
  binName: string
  devPath: string
}

export interface TtsSegmentTask {
  text: string
  sid: number
  speed: number
  outPath: string
}

export interface TtsSegmentOutcome {
  ok: boolean
  outPath: string
  error?: string
}

export class TtsHelperMissingError extends Error {
  constructor(path: string) { super(`TTS 引擎未安装：${path}`); this.name = 'TtsHelperMissingError' }
}

/** 模型加载（ready 行）超时：大模型冷启动可能换页/解压，给足 120s。 */
const READY_TIMEOUT_MS = 120_000

function resolveBinary(config: PlatformTtsHelperConfig): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'tts-helper', config.binName)
    : join(app.getAppPath(), config.devPath)
}

function modelArgs(model: ResolvedTtsModel): string[] {
  const args = ['--family', model.family, '--model', model.modelPath, '--tokens', model.tokensPath]
  if (model.voicesPath) args.push('--voices', model.voicesPath)
  if (model.vocoderPath) args.push('--vocoder', model.vocoderPath)
  if (model.lexiconPaths?.length) args.push('--lexicon', model.lexiconPaths.join(','))
  if (model.dictDirPath) args.push('--dict-dir', model.dictDirPath)
  if (model.dataDirPath) args.push('--data-dir', model.dataDirPath)
  if (model.ruleFsts?.length) args.push('--rule-fsts', model.ruleFsts.join(','))
  return args
}

/** 按行解析 helper stdout；进程退出/出错视为会话终止（next 返回 null）。 */
class HelperLines {
  private buffer = ''
  private queue: string[] = []
  private waiters: Array<(line: string | null) => void> = []
  private ended = false

  constructor(child: ChildProcessWithoutNullStreams) {
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      this.buffer += chunk
      let idx = this.buffer.indexOf('\n')
      while (idx >= 0) {
        const line = this.buffer.slice(0, idx).trim()
        this.buffer = this.buffer.slice(idx + 1)
        if (line) this.push(line)
        idx = this.buffer.indexOf('\n')
      }
    })
    // 用 close 而非 exit：保证 stdout 残余数据先消费完
    const finish = (): void => {
      this.ended = true
      while (this.waiters.length > 0) this.waiters.shift()?.(null)
    }
    child.once('close', finish)
    child.once('error', finish)
  }

  private push(line: string): void {
    const waiter = this.waiters.shift()
    if (waiter) waiter(line)
    else this.queue.push(line)
  }

  next(): Promise<string | null> {
    if (this.queue.length > 0) return Promise.resolve(this.queue.shift() ?? null)
    if (this.ended) return Promise.resolve(null)
    return new Promise((resolve) => this.waiters.push(resolve))
  }
}

interface SpawnedTtsHelper {
  child: ChildProcessWithoutNullStreams
  lines: HelperLines
  stderrText: () => string
}

function spawnHelper(config: PlatformTtsHelperConfig, model: ResolvedTtsModel): SpawnedTtsHelper {
  const binary = resolveBinary(config)
  if (!existsSync(binary)) throw new TtsHelperMissingError(binary)
  const child = spawn(binary, modelArgs(model), { windowsHide: true }) as ChildProcessWithoutNullStreams
  let stderr = ''
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk: string) => { stderr = `${stderr}${chunk}`.slice(-4000) })
  // stdin EPIPE 由写任务的回调统一上报，这里仅防止未监听 error 事件导致进程崩溃
  child.stdin.on('error', () => {})
  return { child, lines: new HelperLines(child), stderrText: () => stderr }
}

/** 等待 ready 行（带 120s 超时）；失败时杀掉子进程再抛错。 */
async function awaitReady(spawned: SpawnedTtsHelper): Promise<{ numSpeakers: number }> {
  let timer: NodeJS.Timeout | undefined
  try {
    const line = await Promise.race([
      spawned.lines.next(),
      new Promise<null>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('TTS 模型加载超时')), READY_TIMEOUT_MS)
      })
    ])
    if (line === null) throw new Error(spawned.stderrText().trim() || 'TTS 引擎启动失败')
    const ready = JSON.parse(line) as { ready?: boolean; numSpeakers?: number }
    if (!ready.ready || !Number.isInteger(ready.numSpeakers) || (ready.numSpeakers ?? 0) < 1) {
      throw new Error('TTS 引擎就绪信号异常')
    }
    return { numSpeakers: ready.numSpeakers as number }
  } catch (error) {
    if (!spawned.child.killed) spawned.child.kill()
    throw error
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function writeTask(child: ChildProcessWithoutNullStreams, task: TtsSegmentTask): Promise<void> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ text: task.text, sid: task.sid, speed: task.speed, out: task.outPath })
    // 写失败（EPIPE 等）= helper 已崩溃
    child.stdin.write(`${payload}\n`, (error) => {
      if (error) reject(new Error('TTS 引擎已崩溃，无法写入任务'))
      else resolve()
    })
  })
}

/**
 * 一次 helper 会话顺序合成多个段：模型只加载一次，逐段写任务、逐行收结果。
 * 单段失败不中断会话（调用方按静音处理）；abort 时杀子进程。
 */
export async function runTtsSession(
  config: PlatformTtsHelperConfig,
  model: ResolvedTtsModel,
  tasks: TtsSegmentTask[],
  onSegment: (result: TtsSegmentOutcome) => void,
  signal: AbortSignal
): Promise<{ failed: number }> {
  const spawned = spawnHelper(config, model)
  const { child, lines } = spawned
  const onAbort = (): void => { if (!child.killed) child.kill() }
  signal.addEventListener('abort', onAbort)
  try {
    await awaitReady(spawned)
    let failed = 0
    for (const task of tasks) {
      if (signal.aborted) break
      await writeTask(child, task)
      const line = await lines.next()
      if (line === null) throw new Error(spawned.stderrText().trim() || 'TTS 引擎意外退出')
      let result: { ok?: boolean; error?: string }
      try { result = JSON.parse(line) as typeof result }
      catch { throw new Error(`TTS 引擎输出异常：${line.slice(0, 120)}`) }
      // helper 回报的 out 是 basename；以任务下发的绝对路径为准
      if (result.ok) onSegment({ ok: true, outPath: task.outPath })
      else { failed += 1; onSegment({ ok: false, outPath: task.outPath, error: result.error ?? '合成失败' }) }
    }
    return { failed }
  } finally {
    signal.removeEventListener('abort', onAbort)
    if (!child.killed) child.kill()
  }
}

/** 导入自定义模型时探测：加载模型读 ready 行的 numSpeakers，随即 quit。 */
export async function probeTtsModel(
  config: PlatformTtsHelperConfig,
  model: ResolvedTtsModel
): Promise<{ numSpeakers: number }> {
  const spawned = spawnHelper(config, model)
  try {
    const ready = await awaitReady(spawned)
    spawned.child.stdin.write('{"cmd":"quit"}\n')
    return ready
  } finally {
    if (!spawned.child.killed) spawned.child.kill()
  }
}
