import { useEffect, useRef, type RefObject } from 'react'

/**
 * 隐藏 <audio> 跟随 <video> 同步播放（kr-01 system-audio 抽取的公共逻辑）：
 * 播放/暂停/seek 镜像，timeupdate 漂移超 300ms 时校正。
 * mic.wav 与 system.wav 两轨各挂一个实例。
 * offsetSec：轨内容相对录制 t=0 的固定偏移（system 轨回声对齐用，正=内容偏晚），
 * 同步目标时间 = video.currentTime + offsetSec。
 * volume：轨增益（0–1，检查器「音频」滑杆），实时写入 audio.volume。
 */
export function useSyncedAudio(
  videoRef: RefObject<HTMLVideoElement | null>,
  audioUrl: string | null,
  offsetSec = 0,
  volume = 1
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
    // 源切换时若视频正在播放（kr-08：TTS 开/关会热切换 mic 轨位的 src），
    // 不会再有 play 事件，必须立即接管，否则播放中无声直到下一次暂停/播放
    if (!video.paused && !video.ended) {
      audio.currentTime = video.currentTime + offsetSec
      void audio.play().catch(() => {})
    }
    return () => {
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('timeupdate', syncTime)
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
  // 同步链路只在 源/偏移 变化时重建；volume 不能进依赖——
  // 否则每次拖滑杆都触发 cleanup（pause + 移除 src 重载），播放中的音轨被打断且不再恢复
  }, [videoRef, audioUrl, offsetSec])

  /** 音量独立 effect：只写 audio.volume，不动同步链路 */
  useEffect(() => {
    const audio = audioRef.current
    if (audio) audio.volume = Math.max(0, Math.min(1, volume))
  }, [volume, audioUrl])

  return audioRef
}
