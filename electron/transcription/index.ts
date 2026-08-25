import type { CaptionLanguage } from '../../shared/captions'
import { probeCaptionModel } from './helper'
import { HELPER_CONFIG as darwinConfig, runCaptionHelper as runDarwin } from './darwin'
import { HELPER_CONFIG as win32Config, runCaptionHelper as runWin32 } from './win32'

export function runCaptionHelper(
  modelPath: string,
  vadModelPath: string,
  wavPath: string,
  language: CaptionLanguage,
  onProgress: (progress: number) => void
) {
  if (process.platform === 'darwin') return runDarwin(modelPath, vadModelPath, wavPath, language, onProgress)
  if (process.platform === 'win32') return runWin32(modelPath, vadModelPath, wavPath, language, onProgress)
  return null
}

export function probeModel(modelPath: string): Promise<void> {
  if (process.platform === 'darwin') return probeCaptionModel(darwinConfig, modelPath)
  if (process.platform === 'win32') return probeCaptionModel(win32Config, modelPath)
  return Promise.reject(new Error(`当前平台 ${process.platform} 不支持字幕模型探测`))
}
