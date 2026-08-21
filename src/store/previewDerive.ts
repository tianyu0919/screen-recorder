import type { MotionEffect } from '@shared/edit'
import type { PreviewSession } from './previewTypes'
import type { MotionParams } from '@/timeline/keyframes'
import { deriveTimelineEffects } from '@/timeline/derive'
import { buildKeyPrompts } from '@/timeline/keyPrompts'

export function derivePreviewEdit(
  current: PreviewSession,
  motionParams: MotionParams,
  motionEffects: MotionEffect[],
  manualKeyPrompts: Array<{ id: string; t: number; keys: string[] }>,
  hiddenRecordedKeyIndices: number[],
  durationMs: number
) {
  return {
    ...deriveTimelineEffects(
      current.timeline,
      motionParams,
      {},
      durationMs,
      motionEffects
    ),
    keyPrompts: buildKeyPrompts(
      current.timeline.events.keys,
      manualKeyPrompts,
      hiddenRecordedKeyIndices
    )
  }
}
