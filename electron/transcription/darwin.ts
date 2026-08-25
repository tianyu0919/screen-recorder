import type { CaptionLanguage } from '../../shared/captions'
import { spawnCaptionHelper, type PlatformHelperConfig } from './helper'

export const HELPER_CONFIG: PlatformHelperConfig = {
  binName: 'whisper-caption',
  devPath: 'native/whisper-caption/bin/darwin/whisper-caption',
  // Some Macs cannot allocate whisper.cpp's Metal buffers. CPU inference is slower but reliable.
  extraArgs: ['-ng']
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
