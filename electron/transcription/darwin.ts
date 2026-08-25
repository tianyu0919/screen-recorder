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
    {
      binName: 'whisper-caption',
      devPath: 'native/whisper-caption/bin/darwin/whisper-caption',
      // Some Macs cannot allocate whisper.cpp's Metal buffers. CPU inference is slower but reliable.
      extraArgs: ['-ng']
    },
    modelPath, vadModelPath, wavPath, language, onProgress
  )
}
