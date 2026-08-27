import type { CaptionsDocument } from '@shared/captions'
import { TTS_ENGINE_VERSION, type TtsSegmentRequest } from '@shared/tts'

/**
 * TTS 配音段请求构建（kr-08-tts-dubbing，纯函数 + WebCrypto sha1，无副作用）。
 * cacheKey 只含规范化文本 + 音色 + 引擎/模型版本：时间窗变化不击穿会话段缓存；
 * derivedKey 额外混入各段时间窗：任何段文本/时间/音色变化都会使整轨指纹失配。
 */

/** 规范化待合成文本：去首尾空白并折叠连续空白，避免无意义差异击穿缓存。 */
export function normalizeTtsText(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

async function sha1Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** 段缓存键：sha1(规范化文本 + voiceId + 引擎/模型版本)。 */
export function ttsSegmentCacheKey(text: string, voiceId: string): Promise<string> {
  return sha1Hex(`${normalizeTtsText(text)}${voiceId}${TTS_ENGINE_VERSION}`)
}

/** 过滤空文本段，构建合成请求（cacheKey + 源时间轴时间窗）。 */
export async function buildTtsSegmentRequests(
  captions: CaptionsDocument,
  voiceId: string
): Promise<TtsSegmentRequest[]> {
  const segments = captions.segments.filter((segment) => normalizeTtsText(segment.text).length > 0)
  return Promise.all(
    segments.map(async (segment) => ({
      segmentId: segment.id,
      text: normalizeTtsText(segment.text),
      startMs: segment.startMs,
      endMs: segment.endMs,
      cacheKey: await ttsSegmentCacheKey(segment.text, voiceId)
    }))
  )
}

/** 整轨指纹：sha1(各段 [cacheKey, startMs, endMs] + voiceId + 引擎/模型版本)。 */
export function ttsDerivedKey(segments: TtsSegmentRequest[], voiceId: string): Promise<string> {
  const payload = JSON.stringify(segments.map((s) => [s.cacheKey, s.startMs, s.endMs]))
  return sha1Hex(`${payload}${voiceId}${TTS_ENGINE_VERSION}`)
}

/** 派生轨等长基准：有 mic.wav 用其时长（sourceDurationMs），否则用视频时长。 */
export function expectedTtsDurationMs(
  hasMic: boolean,
  micDurationMs: number,
  videoDurationMs: number
): number {
  return hasMic ? micDurationMs : videoDurationMs
}
