import type { CaptionLanguage } from '../../shared/captions'
import { spawnCaptionHelper, type PlatformHelperConfig } from './helper'

export const HELPER_CONFIG: PlatformHelperConfig = {
  binName: 'whisper-caption.exe',
  devPath: 'native/whisper-caption/bin/win32/whisper-caption.exe'
}

export function runCaptionHelper(
  modelPath: string,
  vadModelPath: string,
  wavPath: string,
  language: CaptionLanguage,
  onProgress: (progress: number) => void
) {
  return spawnCaptionHelper(HELPER_CONFIG, modelPath, vadModelPath, wavPath, language, onProgress)
}
