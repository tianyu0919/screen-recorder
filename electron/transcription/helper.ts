import { app } from 'electron'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
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

interface PlatformHelperConfig {
  binName: string
  devPath: string
  extraArgs?: string[]
}

export function spawnCaptionHelper(
  config: PlatformHelperConfig,
  modelPath: string,
  vadModelPath: string,
  wavPath: string,
  language: CaptionLanguage,
  onProgress: (progress: number) => void
): RunningCaptionHelper {
  const binary = app.isPackaged
    ? join(process.resourcesPath, 'whisper-caption', config.binName)
    : join(app.getAppPath(), config.devPath)
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
