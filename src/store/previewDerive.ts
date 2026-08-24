import type { MotionEffect } from '@shared/edit'
import type { PreviewSession } from './previewTypes'
import type { MotionParams } from '@/timeline/keyframes'
import { deriveTimelineEffects } from '@/timeline/derive'
import { buildKeyPrompts } from '@/timeline/keyPrompts'
import { fullViewState } from '@/timeline/keyframes'

export function derivePreviewEdit(
  current: PreviewSession,
  motionParams: MotionParams,
  motionEffects: MotionEffect[],
  manualKeyPrompts: Array<{ id: string; t: number; keys: string[] }>,
  hiddenRecordedKeyIndices: number[],
  durationMs: number,
  motionEnabled = true
) {
  const effects = deriveTimelineEffects(
    current.timeline,
    motionParams,
    {},
    durationMs,
    motionEffects
  )
  return {
    ...effects,
    keyframes: motionEnabled
      ? effects.keyframes
      : [{ t: 0, target: fullViewState(current.timeline.canvas) }],
    keyPrompts: buildKeyPrompts(
      current.timeline.events.keys,
      manualKeyPrompts,
      hiddenRecordedKeyIndices
    )
  }
}
