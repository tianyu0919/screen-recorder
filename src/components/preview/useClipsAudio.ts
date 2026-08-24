import { useEffect, useMemo, useRef, type RefObject } from 'react'
import type { CustomClip } from '@/store/previewStore'
import { getClipAsset } from '@/export/clipCache'
import { audioClipPlaybackWindow } from '@/lib/audioClip'

interface ActiveClip {
  source: AudioBufferSourceNode
  gain: GainNode
}

function stopActiveClips(active: Map<string, ActiveClip>): void {
  for (const { source, gain } of active.values()) {
    try {
      source.stop()
    } catch {
      // 已自然结束的一次性 source 再 stop 会抛 InvalidStateError，清理时可忽略。
    }
    source.disconnect()
    gain.disconnect()
  }
  active.clear()
}

/**
 * 所有自定义 clip 共用一个 AudioContext，直接复用导入时的 AudioBuffer。
 * 播放/seek/速率变化时重建一次性 source；逐帧播放路径不做音频 seek。
 */
export function useClipsAudio(
  videoRef: RefObject<HTMLVideoElement | null>,
  clips: CustomClip[]
): void {
  const contextRef = useRef<AudioContext | null>(null)
  const activeRef = useRef(new Map<string, ActiveClip>())
  const clipsRef = useRef(clips)
  clipsRef.current = clips
  const timingKey = useMemo(
    () =>
      clips
        .map((clip) => `${clip.id}:${clip.offsetMs}:${clip.trimStartMs}:${clip.trimEndMs}`)
        .join('|'),
    [clips]
  )

  useEffect(() => {
    for (const clip of clips) {
      const active = activeRef.current.get(clip.id)
      if (active) active.gain.gain.value = clip.muted ? 0 : Math.max(0, Math.min(1, clip.gain))
    }
  }, [clips])

  useEffect(() => {
    const video = videoRef.current
    if (!video || clipsRef.current.length === 0) return
    let revision = 0

    const stop = (): void => {
      revision++
      stopActiveClips(activeRef.current)
    }
    const schedule = async (): Promise<void> => {
      const scheduledRevision = ++revision
      stopActiveClips(activeRef.current)
      if (video.paused) return
      const context = contextRef.current ?? new AudioContext()
      contextRef.current = context
      if (context.state === 'suspended') await context.resume()
      if (scheduledRevision !== revision || video.paused) return

      const rate = Math.max(0.1, video.playbackRate)
      const anchor = context.currentTime + 0.015
      const timelineMs = video.currentTime * 1000
      for (const clip of clipsRef.current) {
        const asset = getClipAsset(clip.id)
        const playback = audioClipPlaybackWindow(clip, timelineMs)
        if (!asset || !playback) continue

        const source = context.createBufferSource()
        const gain = context.createGain()
        source.buffer = asset.audioBuffer
        source.playbackRate.value = rate
        gain.gain.value = clip.muted ? 0 : Math.max(0, Math.min(1, clip.gain))
        source.connect(gain)
        gain.connect(context.destination)
        activeRef.current.set(clip.id, { source, gain })
        source.onended = () => {
          const current = activeRef.current.get(clip.id)
          if (current?.source !== source) return
          source.disconnect()
          gain.disconnect()
          activeRef.current.delete(clip.id)
        }
        source.start(
          anchor + playback.waitMs / 1000 / rate,
          playback.sourceMs / 1000,
          playback.playMs / 1000
        )
      }
    }

    const onSchedule = (): void => void schedule()
    video.addEventListener('playing', onSchedule)
    video.addEventListener('seeked', onSchedule)
    video.addEventListener('ratechange', onSchedule)
    video.addEventListener('pause', stop)
    video.addEventListener('seeking', stop)
    video.addEventListener('waiting', stop)
    video.addEventListener('ended', stop)
    if (!video.paused) void schedule()
    return () => {
      video.removeEventListener('playing', onSchedule)
      video.removeEventListener('seeked', onSchedule)
      video.removeEventListener('ratechange', onSchedule)
      video.removeEventListener('pause', stop)
      video.removeEventListener('seeking', stop)
      video.removeEventListener('waiting', stop)
      video.removeEventListener('ended', stop)
      stop()
    }
  }, [timingKey, videoRef])

  useEffect(
    () => () => {
      stopActiveClips(activeRef.current)
      const context = contextRef.current
      contextRef.current = null
      if (context && context.state !== 'closed') void context.close()
    },
    []
  )
}
