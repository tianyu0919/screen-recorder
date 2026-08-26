import type { Dispatch, MutableRefObject, SetStateAction } from 'react'

interface AnimatorRef {
  current: { reset(tMs: number): void } | null
}

interface PlaybackVideoEventOptions {
  video: HTMLVideoElement
  fallbackDurationMs: number
  animatorRef: AnimatorRef
  lastMsRef: MutableRefObject<number>
  skippingRef: MutableRefObject<boolean>
  probingRef: MutableRefObject<boolean>
  draw(tMs: number): void
  cancelLoop(video: HTMLVideoElement): void
  publishCurrentMs(tMs: number, forceReact?: boolean): void
  setDurationMs: Dispatch<SetStateAction<number>>
  setPlaying: Dispatch<SetStateAction<boolean>>
  setPlaybackError: Dispatch<SetStateAction<string | null>>
}

/** 绑定 video 元数据、探针 seek、结束与错误事件，并返回完整清理函数。 */
export function attachPlaybackVideoEvents(options: PlaybackVideoEventOptions): () => void {
  const {
    video,
    fallbackDurationMs,
    animatorRef,
    lastMsRef,
    skippingRef,
    probingRef,
    draw,
    cancelLoop,
    publishCurrentMs,
    setDurationMs,
    setPlaying,
    setPlaybackError
  } = options
  const syncDuration = (): void => {
    const dur = video.duration * 1000
    setDurationMs(Number.isFinite(dur) ? dur : fallbackDurationMs)
  }
  const onLoadedMetadata = (): void => {
    syncDuration()
    lastMsRef.current = 0
    animatorRef.current?.reset(0)
    publishCurrentMs(0, true)
    if (!Number.isFinite(video.duration)) {
      probingRef.current = true
      video.currentTime = 1e7
    }
  }
  const onDurationChange = (): void => {
    syncDuration()
    if (probingRef.current && Number.isFinite(video.duration)) {
      probingRef.current = false
      video.currentTime = 0
    }
  }
  const onLoadedData = (): void => draw(video.currentTime * 1000)
  const onSeeked = (): void => {
    skippingRef.current = false
    if (probingRef.current) return
    const tMs = video.currentTime * 1000
    lastMsRef.current = tMs
    draw(tMs)
  }
  const onEnded = (): void => {
    skippingRef.current = false
    cancelLoop(video)
    setPlaying(false)
    const tMs = video.currentTime * 1000
    if (tMs > 0) {
      lastMsRef.current = tMs
      setDurationMs((previous) => (Math.abs(tMs - previous) > 200 ? tMs : previous))
      publishCurrentMs(tMs, true)
    }
  }
  const onError = (): void => {
    setPlaybackError(`视频加载失败: code=${video.error?.code ?? '?'} ${video.error?.message ?? ''}`)
  }

  video.addEventListener('loadedmetadata', onLoadedMetadata)
  video.addEventListener('durationchange', onDurationChange)
  video.addEventListener('loadeddata', onLoadedData)
  video.addEventListener('seeked', onSeeked)
  video.addEventListener('ended', onEnded)
  video.addEventListener('error', onError)
  return () => {
    video.removeEventListener('loadedmetadata', onLoadedMetadata)
    video.removeEventListener('durationchange', onDurationChange)
    video.removeEventListener('loadeddata', onLoadedData)
    video.removeEventListener('seeked', onSeeked)
    video.removeEventListener('ended', onEnded)
    video.removeEventListener('error', onError)
  }
}
