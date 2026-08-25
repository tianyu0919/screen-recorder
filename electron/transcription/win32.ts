import type { CaptionLanguage } from '../../shared/captions'
import { spawnCaptionHelper } from './helper'

export function runCaptionHelper(
  modelPath: string,
  vadModelPath: string,
  wavPath: string,
  language: CaptionLanguage,
  onProgress: (progress: number) => void
) {
  return spawnCaptionHelper(
    { binName: 'whisper-caption.exe', devPath: 'native/whisper-caption/bin/win32/whisper-caption.exe' },
    modelPath, vadModelPath, wavPath, language, onProgress
  )
}
