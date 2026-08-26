import { useCallback, useRef, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from 'react'
import { cutAt, type CutRange } from '@/timeline/cuts'
import type { Compositor } from '@/render/compositor'

interface Animator {
  step(dtMs: number): void
  reset(tMs: number): void
}

interface PlaybackLoopOptions {
  videoRef: RefObject<HTMLVideoElement | null>
  compositorRef: MutableRefObject<Compositor | null>
  animatorRef: MutableRefObject<Animator | null>
  cutsRef: MutableRefObject<CutRange[]>
  skippingRef: MutableRefObject<boolean>
  lastMsRef: MutableRefObject<number>
  fallbackDurationMs: number
  draw(tMs: number, uploadVideoFrame?: boolean): void
  publishCurrentMs(tMs: number, forceReact?: boolean): void
  setPlaying: Dispatch<SetStateAction<boolean>>
}

/**
 * 解码帧与显示刷新使用独立调度：rVFC 只上传新纹理，rAF 连续推进时间效果。
 * 这样 VFR/静态画面省略重复帧时，运镜和播放头仍跟随媒体时钟流畅更新。
 */
export function usePlaybackLoops(options: PlaybackLoopOptions): {
  start(video: HTMLVideoElement): void
  cancel(video: HTMLVideoElement): void
} {
  const {
    videoRef,
    compositorRef,
    animatorRef,
    cutsRef,
    skippingRef,
    lastMsRef,
    fallbackDurationMs,
    draw,
    publishCurrentMs,
    setPlaying
  } = options
  const rafRef = useRef(0)
  const rvfcRef = useRef(0)

  const cancel = useCallback((video: HTMLVideoElement) => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
    if (rvfcRef.current) {
      video.cancelVideoFrameCallback(rvfcRef.current)
      rvfcRef.current = 0
    }
  }, [])

  const onVideoFrame = useCallback(
    function frame() {
      const video = videoRef.current
      if (!video || video.paused) return
      compositorRef.current?.uploadFrame(video)
      rvfcRef.current = video.requestVideoFrameCallback(frame)
    },
    [videoRef, compositorRef]
  )

  const onAnimationFrame = useCallback(
    function frame() {
      const video = videoRef.current
      if (!video || video.paused) return
      if (!skippingRef.current) {
        const tMs = video.currentTime * 1000
        const cut = cutAt(tMs, cutsRef.current)
        if (cut !== null) {
          const rawEnd = Number.isFinite(video.duration)
            ? video.duration * 1000
            : fallbackDurationMs
          if (cut.endMs >= rawEnd - 50) {
            video.pause()
            cancel(video)
            setPlaying(false)
            video.currentTime = cut.startMs / 1000
            lastMsRef.current = cut.startMs
            animatorRef.current?.reset(cut.startMs)
            publishCurrentMs(cut.startMs, true)
            return
          }
          skippingRef.current = true
          video.currentTime = cut.endMs / 1000
          lastMsRef.current = cut.endMs
        } else {
          const dt = Math.max(0, tMs - lastMsRef.current)
          lastMsRef.current = tMs
          animatorRef.current?.step(dt)
          draw(tMs, false)
          publishCurrentMs(tMs)
        }
      }
      rafRef.current = requestAnimationFrame(frame)
    },
    [videoRef, skippingRef, cutsRef, fallbackDurationMs, cancel, setPlaying, lastMsRef,
      animatorRef, publishCurrentMs, draw]
  )

  const start = useCallback((video: HTMLVideoElement) => {
    cancel(video)
    // 先上传当前可用帧，避免首个 rAF 在 rVFC 之前到达时使用旧纹理。
    compositorRef.current?.uploadFrame(video)
    rvfcRef.current = video.requestVideoFrameCallback(onVideoFrame)
    rafRef.current = requestAnimationFrame(onAnimationFrame)
  }, [cancel, onAnimationFrame, onVideoFrame, compositorRef])

  return { start, cancel }
}
