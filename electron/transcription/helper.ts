import { app } from 'electron'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import OpenCC from 'opencc-js/t2cn'
import type { CaptionLanguage, CaptionSegment } from '../../shared/captions'
import { parseWhisperProgress, parseWhisperSrt } from '../../shared/transcription'

export interface HelperResult {
  segments: CaptionSegment[]
  detectedLanguage?: string
}

export interface RunningCaptionHelper {
  result: Promise<HelperResult>
  cancel(): void
}

export interface PlatformHelperConfig {
  binName: string
  devPath: string
  extraArgs?: string[]
}

function resolveBinary(config: PlatformHelperConfig): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'whisper-caption', config.binName)
    : join(app.getAppPath(), config.devPath)
}

export function spawnCaptionHelper(
  config: PlatformHelperConfig,
  modelPath: string,
  vadModelPath: string,
  wavPath: string,
  language: CaptionLanguage,
  onProgress: (progress: number) => void
): RunningCaptionHelper {
  const binary = resolveBinary(config)
  if (!existsSync(binary)) throw new CaptionHelperMissingError(binary)
  const outputPrefix = join(app.getPath('temp'), `lenza-captions-${process.pid}-${Date.now()}`)
  const simplifiedChinese = OpenCC.Converter({ from: 'tw', to: 'cn' })
  const args = [
    '-m', modelPath, '-f', wavPath, '-l', language, '-osrt', '-pp',
    '--vad', '-vm', vadModelPath, '-vsd', '350', '-vp', '80', '-ml', '1',
    ...(language === 'zh' ? ['--prompt', '以下是普通话录音的简体中文转写。'] : []),
    ...(config.extraArgs ?? []), '-of', outputPrefix
  ]
  const child = spawn(binary, args, { windowsHide: true }) as ChildProcessWithoutNullStreams
  child.stdout.resume()
  let stderr = ''
  let detectedLanguage: string | undefined
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk: string) => {
    stderr = `${stderr}${chunk}`.slice(-8000)
    detectedLanguage = detectedLanguage ?? /auto-detected language:\s*([a-z-]+)/i.exec(chunk)?.[1]
    const progress = parseWhisperProgress(chunk)
    if (progress !== null) onProgress(progress)
  })
  const result = new Promise<HelperResult>((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      const srtPath = `${outputPrefix}.srt`
      try {
        if (signal || code !== 0) throw new Error(stderr.trim() || `字幕 helper 退出码 ${code}`)
        if (!existsSync(srtPath)) throw new Error('字幕 helper 未生成结果')
        const segments = parseWhisperSrt(readFileSync(srtPath, 'utf8'))
        const shouldSimplify = language === 'zh' || detectedLanguage?.startsWith('zh')
        resolve({
          detectedLanguage,
          segments: shouldSimplify ? segments.map((segment) => ({ ...segment, text: simplifiedChinese(segment.text) })) : segments
        })
      } catch (error) { reject(error) }
      finally { void rm(srtPath, { force: true }) }
    })
  })
  return { result, cancel: () => { if (!child.killed) child.kill() } }
}

export class CaptionHelperMissingError extends Error {
  constructor(path: string) { super(`字幕引擎未安装：${path}`); this.name = 'CaptionHelperMissingError' }
}

const PROBE_TIMEOUT_MS = 120_000

/** 用一段静音 WAV 让 helper 实际加载模型，验证自定义模型与当前平台引擎兼容。 */
export async function probeCaptionModel(config: PlatformHelperConfig, modelPath: string): Promise<void> {
  const binary = resolveBinary(config)
  const wavPath = join(app.getPath('temp'), `lenza-model-probe-${process.pid}-${Date.now()}.wav`)
  await writeSilentWav(wavPath)
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        binary,
        ['-m', modelPath, '-f', wavPath, '-l', 'auto', '-nt', ...(config.extraArgs ?? [])],
        { windowsHide: true }
      ) as ChildProcessWithoutNullStreams
      child.stdout.resume()
      let stderr = ''
      child.stderr.setEncoding('utf8')
      child.stderr.on('data', (chunk: string) => { stderr = `${stderr}${chunk}`.slice(-4000) })
      const timer = setTimeout(() => {
        child.kill()
        reject(new Error('模型加载探测超时'))
      }, PROBE_TIMEOUT_MS)
      child.once('error', (error) => { clearTimeout(timer); reject(error) })
      child.once('exit', (code, signal) => {
        clearTimeout(timer)
        if (signal || code !== 0) reject(new Error(stderr.trim() || `字幕引擎退出码 ${code}`))
        else resolve()
      })
    })
  } finally { void rm(wavPath, { force: true }) }
}

async function writeSilentWav(path: string): Promise<void> {
  const samples = 16_000 / 2 // 0.5s 16kHz 单声道
  const dataSize = samples * 2
  const header = Buffer.alloc(44)
  header.write('RIFF', 0); header.writeUInt32LE(36 + dataSize, 4); header.write('WAVE', 8)
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22); header.writeUInt32LE(16_000, 24); header.writeUInt32LE(32_000, 28)
  header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34)
  header.write('data', 36); header.writeUInt32LE(dataSize, 40)
  await writeFile(path, Buffer.concat([header, Buffer.alloc(dataSize)]))
}
