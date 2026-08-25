import type { CaptionLanguage } from '../../shared/captions'
import { runCaptionHelper as runDarwin } from './darwin'
import { runCaptionHelper as runWin32 } from './win32'

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
