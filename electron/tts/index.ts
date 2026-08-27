import {
  probeTtsModel as probeWithConfig,
  runTtsSession as runWithConfig,
  type PlatformTtsHelperConfig,
  type TtsSegmentOutcome,
  type TtsSegmentTask
} from './helper'
import type { ResolvedTtsModel } from './modelManager'
import { HELPER_CONFIG as darwinConfig } from './darwin'
import { HELPER_CONFIG as win32Config } from './win32'

/** 平台分发：实现全在 helper.ts，darwin.ts/win32.ts 只提供路径配置；其他平台返回 null 静默降级。 */
function platformConfig(): PlatformTtsHelperConfig | null {
  if (process.platform === 'darwin') return darwinConfig
  if (process.platform === 'win32') return win32Config
  return null
}

export function runTtsSession(
  model: ResolvedTtsModel,
  tasks: TtsSegmentTask[],
  onSegment: (result: TtsSegmentOutcome) => void,
  signal: AbortSignal
): Promise<{ failed: number }> | null {
  const config = platformConfig()
  return config ? runWithConfig(config, model, tasks, onSegment, signal) : null
}

export function probeTtsModel(model: ResolvedTtsModel): Promise<{ numSpeakers: number }> {
  const config = platformConfig()
  if (!config) return Promise.reject(new Error(`当前平台 ${process.platform} 不支持 TTS 模型探测`))
  return probeWithConfig(config, model)
}
