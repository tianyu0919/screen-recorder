import type {
  EditDocument,
  EditDocumentV1,
  EditDocumentV3,
  MotionEffect,
  PersistedAudioClip,
  PersistedAudioClipV1,
  TtsEditSettings
} from '@shared/edit'
import {
  DEFAULT_BACKGROUND_PADDING_PERCENT,
  normalizeBackgroundPaddingPercent
} from '@shared/edit'
import type { RecordingEventsV2 } from '@shared/eventsV2'
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

const DEFAULT_BACKGROUND_COLOR = '#16181D'

function isAudioClip(value: unknown): value is PersistedAudioClipV1 {
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

function normalizeColor(value: unknown): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toUpperCase()
    : DEFAULT_BACKGROUND_COLOR
}

export function parseEditDocument(json: string): EditDocument {
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch {
    throw new EditDocumentError('edit.json 不是合法 JSON')
  }
  if (!value || typeof value !== 'object') throw new EditDocumentError('edit.json 结构无效')
  const version = (value as { version?: unknown }).version
  if (version !== 1 && version !== 2 && version !== 3) throw new EditDocumentError('edit.json 版本不受支持')
  const doc = value as Partial<EditDocumentV1> &
    Partial<Omit<EditDocumentV3, 'version' | 'customAudio'>> & {
      customAudio?: Array<PersistedAudioClipV1 | PersistedAudioClip>
    }
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
    version: 3,
    updatedAt: typeof doc.updatedAt === 'string' ? doc.updatedAt : new Date(0).toISOString(),
    motionEnabled: version !== 1 ? doc.motionEnabled !== false : true,
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
    audioMute: {
      mic: version !== 1 && doc.audioMute?.mic === true,
      system: version !== 1 && doc.audioMute?.system === true
    },
    customAudio: doc.customAudio.map((clip) => ({
      ...clip,
      muted: version !== 1 && (clip as Partial<PersistedAudioClip>).muted === true
    })),
    keyboardOverlay: {
      x: Math.min(1, Math.max(0, keyboard.x)),
      y: Math.min(1, Math.max(0, keyboard.y))
    },
    renderSettings: {
      backgroundEnabled: version !== 1 && doc.renderSettings?.backgroundEnabled === true,
      backgroundColor: normalizeColor(doc.renderSettings?.backgroundColor),
      backgroundPaddingPercent: normalizeBackgroundPaddingPercent(
        doc.renderSettings?.backgroundPaddingPercent
      )
    },
    // V3 新增；V1/V2 迁移为未配置（TTS 关闭）。字段损坏按未配置处理（回退原声）。
    ...(version === 3 ? { tts: parseTtsSettings(doc.tts) } : {})
  }
}

/** 宽松解析 tts 字段：仅 enabled=true 且必要字段齐备时保留，否则视为未配置。 */
function parseTtsSettings(value: unknown): TtsEditSettings | undefined {
  if (!value || typeof value !== 'object') return undefined
  const t = value as Partial<TtsEditSettings>
  if (t.enabled !== true) return undefined
  if (typeof t.voiceId !== 'string' || !t.voiceId) return undefined
  if (typeof t.engineVersion !== 'string' || !t.engineVersion) return undefined
  return {
    enabled: true,
    voiceId: t.voiceId,
    engineVersion: t.engineVersion,
    derivedFile: typeof t.derivedFile === 'string' && /^[\w.-]+$/.test(t.derivedFile)
      ? t.derivedFile
      : undefined,
    derivedKey: typeof t.derivedKey === 'string' && /^[0-9a-f]{40}$/.test(t.derivedKey)
      ? t.derivedKey
      : undefined,
    overflowSegmentIds: Array.isArray(t.overflowSegmentIds)
      ? t.overflowSegmentIds.filter((id): id is string => typeof id === 'string')
      : undefined
  }
}

export function createDefaultEditDocument(
  events: RecordingEventsV2,
  canvas: CanvasSize,
  motionParams: MotionParams,
  durationMs: number
): EditDocument {
  return {
    version: 3,
    updatedAt: new Date(0).toISOString(),
    motionEnabled: true,
    motionParams,
    motionEffects: createDefaultMotionEffects(events, canvas, motionParams, durationMs),
    manualKeyPrompts: [],
    hiddenRecordedKeyIndices: [],
    cuts: [],
    audioGain: { mic: 1, system: 1 },
    audioMute: { mic: false, system: false },
    customAudio: [],
    keyboardOverlay: { x: 0.5, y: 0.86 },
    renderSettings: {
      backgroundEnabled: false,
      backgroundColor: DEFAULT_BACKGROUND_COLOR,
      backgroundPaddingPercent: DEFAULT_BACKGROUND_PADDING_PERCENT
    }
  }
}

export function serializeEditDocument(document: EditDocument): string {
  return JSON.stringify({ ...document, updatedAt: new Date().toISOString() })
}
