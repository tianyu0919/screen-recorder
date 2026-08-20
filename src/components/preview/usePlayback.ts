import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { CameraKeyframe } from '@shared/types'
import type { CanvasSize } from '@/timeline/types'
import { createCameraAnimator } from '@/timeline/spring'
import { Compositor } from '@/render/compositor'
import type { RenderInfo, RipplePoint } from '@/render/types'

/**
 * 预览播放引擎 hook（Task 3.1/3.2）：
 * 隐藏 <video> 作帧源，requestVideoFrameCallback 驱动渲染循环；
 * 实时播放用 createCameraAnimator 增量积分，seek 用 animator.reset(tMs)
 * 从头重放到目标时刻（与 sampleCameraAt 结果一致），随后立即 drawFrame 呈现。
 * 卸载/换会话时完整释放：cancelVideoFrameCallback、animator 重建、compositor.dispose。
 */

interface PlaybackOptions {
  /** 视频分辨率（会话加载后非空） */
  canvasSize: CanvasSize | null
  keyframes: CameraKeyframe[]
  ripples: RipplePoint[]
  /**
   * webm 缺 Duration 元数据（MediaRecorder 已知行为）导致 video.duration=Infinity 时
   * 的回退时长（取 timeline 事件时间轴估计），否则进度条/播放被禁用。
   */
  fallbackDurationMs: number
}

export interface Playback {
  playing: boolean
  currentMs: number
  durationMs: number
  /** 最近一帧渲染信息（降采样 UI 明示数据） */
  renderInfo: RenderInfo | null
  playbackError: string | null
  togglePlay(): void
  seekTo(ms: number): void
}

export function usePlayback(
  videoRef: RefObject<HTMLVideoElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  { canvasSize, keyframes, ripples, fallbackDurationMs }: PlaybackOptions
): Playback {
  const compositorRef = useRef<Compositor | null>(null)
  const animatorRef = useRef<ReturnType<typeof createCameraAnimator> | null>(null)
  const rvfcRef = useRef(0)
  const lastMsRef = useRef(0)
  const ripplesRef = useRef(ripples)
  ripplesRef.current = ripples
  const [playing, setPlaying] = useState(false)
  const [currentMs, setCurrentMs] = useState(0)
  const [durationMs, setDurationMs] = useState(0)
  const [renderInfo, setRenderInfo] = useState<RenderInfo | null>(null)
  const [playbackError, setPlaybackError] = useState<string | null>(null)

  /** 用当前已解码帧 + 当前相机状态合成一帧（readyState < 2 时无帧可画，跳过） */
  const draw = useCallback(
    (tMs: number) => {
      const video = videoRef.current
      const comp = compositorRef.current
      const anim = animatorRef.current
      if (!video || !comp || !anim || video.readyState < 2) return
      setRenderInfo(comp.drawFrame(video, anim.sample(), tMs, ripplesRef.current))
    },
    [videoRef]
  )

  /** 合成器生命周期：随画布与视频分辨率创建/销毁 */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !canvasSize) return
    try {
      const comp = new Compositor(canvas)
      comp.setCanvasSize(canvasSize)
      compositorRef.current = comp
      setPlaybackError(null)
      return () => {
        comp.dispose()
        compositorRef.current = null
      }
    } catch (err) {
      setPlaybackError(
        `合成器初始化失败: ${err instanceof Error ? err.message : String(err)}`
      )
      return
    }
  }, [canvasRef, canvasSize])

  /** animator 生命周期：关键帧变化（参数调整）时重建并重放到当前时刻、立即重绘 */
  useEffect(() => {
    if (!canvasSize) {
      animatorRef.current = null
      return
    }
    const anim = createCameraAnimator(keyframes, canvasSize)
    animatorRef.current = anim
    anim.reset(lastMsRef.current)
    draw(lastMsRef.current)
  }, [keyframes, canvasSize, draw])

  const cancelLoop = useCallback(
    (video: HTMLVideoElement) => {
      if (rvfcRef.current) {
        video.cancelVideoFrameCallback(rvfcRef.current)
        rvfcRef.current = 0
      }
    },
    []
  )

  /** rVFC 渲染循环：每个新视频帧推进 animator 增量积分并合成 */
  const onFrame = useCallback(
    function frame() {
      const video = videoRef.current
      if (!video || video.paused) return
      const tMs = video.currentTime * 1000
      const dt = Math.max(0, tMs - lastMsRef.current)
      lastMsRef.current = tMs
      animatorRef.current?.step(dt)
      draw(tMs)
      setCurrentMs(tMs)
      rvfcRef.current = video.requestVideoFrameCallback(frame)
    },
    [videoRef, draw]
  )

  /** video 元素事件：元数据/时长/首帧/seek 完成/播放结束 */
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    // MediaRecorder 产出的 webm 无 Duration 元数据 → duration=Infinity，
    // 回退到事件时间轴估计时长；Chrome 之后解析出真实时长时 durationchange 再修正
    const syncDuration = () => {
      const dur = video.duration * 1000
      setDurationMs(Number.isFinite(dur) ? dur : fallbackDurationMs)
    }
    const onLoadedMetadata = () => {
      syncDuration()
      lastMsRef.current = 0
      animatorRef.current?.reset(0)
      setCurrentMs(0)
    }
    // 首帧可解码即呈现（loadedmetadata 时 readyState 可能仍 < 2）
    const onLoadedData = () => draw(video.currentTime * 1000)
    // seek 完成：用目标位置的新解码帧重绘（seekTo 已先用旧帧 + 新相机即时呈现）
    const onSeeked = () => {
      const tMs = video.currentTime * 1000
      lastMsRef.current = tMs
      draw(tMs)
    }
    const onEnded = () => {
      cancelLoop(video)
      setPlaying(false)
    }
    const onError = () => {
      setPlaybackError(
        `视频加载失败: code=${video.error?.code ?? '?'} ${video.error?.message ?? ''}`
      )
    }
    video.addEventListener('loadedmetadata', onLoadedMetadata)
    video.addEventListener('durationchange', syncDuration)
    video.addEventListener('loadeddata', onLoadedData)
    video.addEventListener('seeked', onSeeked)
    video.addEventListener('ended', onEnded)
    video.addEventListener('error', onError)
    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata)
      video.removeEventListener('durationchange', syncDuration)
      video.removeEventListener('loadeddata', onLoadedData)
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('ended', onEnded)
      video.removeEventListener('error', onError)
    }
  }, [videoRef, draw, cancelLoop, fallbackDurationMs])

  /** 卸载兜底：停循环、停视频（compositor 由上方 effect 释放） */
  useEffect(
    () => () => {
      const video = videoRef.current
      if (video) {
        cancelLoop(video)
        video.pause()
        video.removeAttribute('src')
        video.load()
      }
    },
    [videoRef, cancelLoop]
  )

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      // 播完再播从头开始
      if (video.ended) video.currentTime = 0
      lastMsRef.current = video.currentTime * 1000
      // 增量积分与从头重放确定性一致，reset 不产生跳变，仅作状态对齐保险
      animatorRef.current?.reset(lastMsRef.current)
      void video
        .play()
        .then(() => {
          // then 回调前用户可能已暂停：只在仍处于播放态时启动渲染循环
          if (video.paused) return
          setPlaying(true)
          rvfcRef.current = video.requestVideoFrameCallback(onFrame)
        })
        .catch(() => {
          // play() 被中断（快速暂停/卸载时移除 src）：无需处理
        })
    } else {
      video.pause()
      cancelLoop(video)
      setPlaying(false)
    }
  }, [videoRef, onFrame, cancelLoop])

  /** 拖拽 seek：任意时间点从头重放求相机状态，立即合成呈现（暂停态同样生效） */
  const seekTo = useCallback(
    (ms: number) => {
      const video = videoRef.current
      if (!video) return
      // duration=Infinity（webm 无 Duration 元数据）时用事件时间轴估计时长做钳制上限
      const durMs = Number.isFinite(video.duration)
        ? video.duration * 1000
        : fallbackDurationMs
      const tMs = Math.max(0, durMs > 0 ? Math.min(ms, durMs) : ms)
      video.currentTime = tMs / 1000
      lastMsRef.current = tMs
      animatorRef.current?.reset(tMs)
      setCurrentMs(tMs)
      draw(tMs)
    },
    [videoRef, draw, fallbackDurationMs]
  )

  return { playing, currentMs, durationMs, renderInfo, playbackError, togglePlay, seekTo }
}
