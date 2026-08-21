import type { EditDocumentV1, MotionEffect, PersistedAudioClip } from '@shared/edit'
import type { RecordingEvents } from '@shared/types'
import { normalizeCuts } from './cuts'
import type { MotionParams } from './keyframes'
import { createDefaultMotionEffects } from './motionEffects'
import type { CanvasSize } from './types'

export class EditDocumentError extends Error {}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isMotionEffect(value: unknown): value is MotionEffect {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<MotionEffect>
  return (
    typeof item.id === 'string' &&
    (item.origin === 'recorded-click' || item.origin === 'manual') &&
    finite(item.startMs) &&
    finite(item.endMs) &&
    finite(item.zoom) &&
    Array.isArray(item.sourceClickIndices) &&
    item.sourceClickIndices.every(finite) &&
    Array.isArray(item.rippleOffsetsMs) &&
    item.rippleOffsetsMs.every(finite)
  )
}

function isAudioClip(value: unknown): value is PersistedAudioClip {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<PersistedAudioClip>
  return (
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.assetFile === 'string' &&
    finite(item.offsetMs) &&
    finite(item.gain) &&
    finite(item.sourceDurationMs) &&
    finite(item.trimStartMs) &&
    finite(item.trimEndMs) &&
    Array.isArray(item.peaks) &&
    item.peaks.every(finite)
  )
}

function isMotionParams(value: unknown): value is MotionParams {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<MotionParams>
  return (
    finite(item.targetZoom) &&
    finite(item.dwellMs) &&
    finite(item.returnThresholdMs) &&
    finite(item.leadMs)
  )
}

export function parseEditDocument(json: string): EditDocumentV1 {
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch {
    throw new EditDocumentError('edit.json 不是合法 JSON')
  }
  if (!value || typeof value !== 'object') throw new EditDocumentError('edit.json 结构无效')
  const doc = value as Partial<EditDocumentV1>
  if (doc.version !== 1) throw new EditDocumentError('edit.json 版本不受支持')
  if (!isMotionParams(doc.motionParams)) throw new EditDocumentError('运镜参数损坏')
  if (!Array.isArray(doc.motionEffects) || !doc.motionEffects.every(isMotionEffect)) {
    throw new EditDocumentError('运镜片段数据损坏')
  }
  if (!Array.isArray(doc.manualKeyPrompts)) throw new EditDocumentError('键盘提示数据损坏')
  if (!Array.isArray(doc.customAudio) || !doc.customAudio.every(isAudioClip)) {
    throw new EditDocumentError('自定义音频数据损坏')
  }
  const keyboard = doc.keyboardOverlay
  if (!keyboard || !finite(keyboard.x) || !finite(keyboard.y)) {
    throw new EditDocumentError('按键提示位置损坏')
  }
  return {
    version: 1,
    updatedAt: typeof doc.updatedAt === 'string' ? doc.updatedAt : new Date(0).toISOString(),
    motionParams: doc.motionParams,
    motionEffects: doc.motionEffects,
    manualKeyPrompts: doc.manualKeyPrompts.flatMap((prompt) =>
      prompt &&
      typeof prompt.id === 'string' &&
      finite(prompt.t) &&
      Array.isArray(prompt.keys) &&
      prompt.keys.every((key) => typeof key === 'string')
        ? [prompt]
        : []
    ),
    hiddenRecordedKeyIndices: Array.isArray(doc.hiddenRecordedKeyIndices)
      ? doc.hiddenRecordedKeyIndices.filter(finite)
      : [],
    cuts: normalizeCuts(Array.isArray(doc.cuts) ? doc.cuts : []),
    audioGain: {
      mic: finite(doc.audioGain?.mic) ? Math.min(1, Math.max(0, doc.audioGain.mic)) : 1,
      system: finite(doc.audioGain?.system)
        ? Math.min(1, Math.max(0, doc.audioGain.system))
        : 1
    },
    customAudio: doc.customAudio,
    keyboardOverlay: {
      x: Math.min(1, Math.max(0, keyboard.x)),
      y: Math.min(1, Math.max(0, keyboard.y))
    }
  }
}

export function createDefaultEditDocument(
  events: RecordingEvents,
  canvas: CanvasSize,
  motionParams: MotionParams,
  durationMs: number
): EditDocumentV1 {
  return {
    version: 1,
    updatedAt: new Date(0).toISOString(),
    motionParams,
    motionEffects: createDefaultMotionEffects(events, canvas, motionParams, durationMs),
    manualKeyPrompts: [],
    hiddenRecordedKeyIndices: [],
    cuts: [],
    audioGain: { mic: 1, system: 1 },
    customAudio: [],
    keyboardOverlay: { x: 0.5, y: 0.86 }
  }
}

export function serializeEditDocument(document: EditDocumentV1): string {
  return JSON.stringify({ ...document, updatedAt: new Date().toISOString() })
}
