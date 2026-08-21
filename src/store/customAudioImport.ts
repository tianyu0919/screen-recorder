import { computePeaks, decodeAudioFile } from '@/lib/audioFile'
import { clampAudioClipToTimeline, type CustomClip } from '@/lib/audioClip'
import type { WavData } from '@/export/audio'

export type CustomAudioImportResult =
  | { kind: 'cancel' }
  | { kind: 'error'; message: string }
  | {
      kind: 'success'
      clip: CustomClip
      wav: WavData
      audioBuffer: AudioBuffer
      sourceData: ArrayBuffer
    }

/** 选择并解码音频；同一 AudioBuffer 直接供 Web Audio 预览复用。 */
export async function importCustomAudio(
  timelineDurationMs: number,
  offsetMs = 0
): Promise<CustomAudioImportResult> {
  let pickedName = ''
  try {
    const picked = await window.api.pickAudioFile()
    if (!picked) return { kind: 'cancel' }
    pickedName = picked.name
    // decodeAudioData 按 Web Audio 规范可分离输入 ArrayBuffer；先保留一份独立字节，
    // 否则解码完成后把同一 buffer 交给 IPC 持久化会报“detached ArrayBuffer”。
    const sourceData = picked.data.slice(0)
    const { wav, audioBuffer } = await decodeAudioFile(picked.data)
    const sourceDurationMs = (wav.samples.length / wav.channels / wav.sampleRate) * 1000
    const clip = clampAudioClipToTimeline(
      {
        id: crypto.randomUUID(),
        name: picked.name,
        offsetMs,
        gain: 1,
        sourceDurationMs,
        trimStartMs: 0,
        trimEndMs: sourceDurationMs,
        peaks: computePeaks(wav)
      },
      timelineDurationMs
    )
    return { kind: 'success', clip, wav, audioBuffer, sourceData }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    return {
      kind: 'error',
      message: pickedName
        ? `无法添加音频文件「${pickedName}」：${detail}`
        : `无法选择音频文件：${detail}`
    }
  }
}
