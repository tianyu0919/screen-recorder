import { useEffect, useRef, type RefObject } from 'react'

/**
 * 隐藏 <audio> 跟随 <video> 同步播放（kr-01 system-audio 抽取的公共逻辑）：
 * 播放/暂停/seek 镜像，timeupdate 漂移超 300ms 时校正。
 * mic.wav 与 system.wav 两轨各挂一个实例。
 */
export function useSyncedAudio(
  videoRef: RefObject<HTMLVideoElement | null>,
  audioUrl: string | null
): RefObject<HTMLAudioElement> {
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const video = videoRef.current
    const audio = audioRef.current
    if (!video || !audio || !audioUrl) return
    if (audio.src !== audioUrl) audio.src = audioUrl
    const syncTime = () => {
      if (Math.abs(audio.currentTime - video.currentTime) > 0.3) {
        audio.currentTime = video.currentTime
      }
    }
    const onPlay = () => {
      audio.currentTime = video.currentTime
      void audio.play().catch(() => {})
    }
    const onPause = () => audio.pause()
    const onSeeked = () => {
      audio.currentTime = video.currentTime
    }
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('seeked', onSeeked)
    video.addEventListener('timeupdate', syncTime)
    return () => {
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('timeupdate', syncTime)
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
  }, [videoRef, audioUrl])

  return audioRef
}
