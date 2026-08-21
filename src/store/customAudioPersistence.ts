import type { PersistedAudioClip } from '@shared/edit'
import type { CustomClip } from '@/lib/audioClip'
import { decodeAudioFile } from '@/lib/audioFile'
import { setClipAsset } from '@/export/clipCache'

export async function restoreCustomAudio(
  sessionId: string,
  clips: PersistedAudioClip[]
): Promise<{ clips: CustomClip[]; error: string | null }> {
  const restored: CustomClip[] = []
  const failed: string[] = []
  for (const clip of clips) {
    try {
      const data = await window.api.loadSessionAudioAsset(sessionId, clip.assetFile)
      const decoded = await decodeAudioFile(data)
      setClipAsset(clip.id, decoded)
      restored.push(clip)
    } catch {
      failed.push(clip.name)
      // 保留块与编辑参数，便于用户识别并删除丢失资产。
      restored.push(clip)
    }
  }
  return {
    clips: restored,
    error: failed.length > 0 ? `以下音频资产无法恢复：${failed.join('、')}` : null
  }
}
