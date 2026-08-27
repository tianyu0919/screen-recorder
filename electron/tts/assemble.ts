import { existsSync } from 'node:fs'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { TtsSegmentRequest } from '../../shared/tts'
import {
  assembleDerivedTrack,
  parseWav16,
  writeWav16,
  type TtsSegmentPlacement
} from '../../shared/ttsPcm'

/**
 * TTS 派生轨组装（kr-08）：读会话目录 tts-segments/<cacheKey>.wav 各段，
 * 经 shared/ttsPcm 拼到等长静音底（48k/2ch/int16），临时文件 + rename 原子写到
 * 会话目录 tts-<derivedKey 前 8 位>.wav。失败/缺失/损坏段按静音处理（组装时跳过）。
 */
export async function assembleDerivedWav(
  sessionDir: string,
  derivedKey: string,
  segments: TtsSegmentRequest[],
  totalDurationMs: number,
  failedSegmentIds: ReadonlySet<string>
): Promise<{ derivedFile: string; clampedSegmentIds: string[] }> {
  const segmentsDir = join(sessionDir, 'tts-segments')
  const placements: TtsSegmentPlacement[] = []
  for (const segment of segments) {
    if (failedSegmentIds.has(segment.segmentId)) continue
    const path = join(segmentsDir, `${segment.cacheKey}.wav`)
    if (!existsSync(path)) continue
    const buffer = await readFile(path)
    const pcm = parseWav16(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))
    if (!pcm) continue // 损坏段同样按静音跳过，不阻断整轨
    placements.push({ pcm, startMs: segment.startMs, endMs: segment.endMs, segmentId: segment.segmentId })
  }
  const { pcm, clampedSegmentIds } = assembleDerivedTrack(placements, totalDurationMs)
  const derivedFile = `tts-${derivedKey.slice(0, 8)}.wav`
  const target = join(sessionDir, derivedFile)
  const temporary = `${target}.${process.pid}.tmp`
  await writeFile(temporary, Buffer.from(writeWav16(pcm)))
  await rename(temporary, target)
  return { derivedFile, clampedSegmentIds }
}
