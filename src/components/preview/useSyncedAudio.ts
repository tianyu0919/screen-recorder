import { useEffect, useRef, type RefObject } from 'react'

/**
 * 隐藏 <audio> 跟随 <video> 同步播放（kr-01 system-audio 抽取的公共逻辑）：
 * 播放/暂停/seek 镜像，timeupdate 漂移超 300ms 时校正。
 * mic.wav 与 system.wav 两轨各挂一个实例。
 * offsetSec：轨内容相对录制 t=0 的固定偏移（system 轨回声对齐用，正=内容偏晚），
 * 同步目标时间 = video.currentTime + offsetSec。
 */
export function useSyncedAudio(
  videoRef: RefObject<HTMLVideoElement | null>,
  audioUrl: string | null,
  offsetSec = 0
): RefObject<HTMLAudioElement> {
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const video = videoRef.current
    const audio = audioRef.current
    if (!video || !audio || !audioUrl) return
    if (audio.src !== audioUrl) audio.src = audioUrl
    const syncTime = () => {
      const target = video.currentTime + offsetSec
      if (Math.abs(audio.currentTime - target) > 0.3) {
        audio.currentTime = target
      }
    }
    const onPlay = () => {
      audio.currentTime = video.currentTime + offsetSec
      void audio.play().catch(() => {})
    }
    const onPause = () => audio.pause()
    const onSeeked = () => {
      audio.currentTime = video.currentTime + offsetSec
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
  }, [videoRef, audioUrl, offsetSec])

  return audioRef
}
