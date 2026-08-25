import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { createCameraAnimator } from '@/timeline/spring'
import { Compositor } from '@/render/compositor'
import type { RenderInfo } from '@/render/types'
import { cutAt, isPlaybackAtCutEnd, normalizeCuts, snapSeekTimeToCuts } from '@/timeline/cuts'
import { previewCompositorConfig, sameRenderInfo } from './playbackRender'
import type { Playback, PlaybackOptions } from './playbackTypes'
import { attachPlaybackVideoEvents } from './playbackVideoEvents'
import { keyOverlayFrameAt } from '@/render/keyOverlay'
import { hexToRgba, resolveOutputPlan } from '@/render/outputPlan'
import { PreviewPerformanceMonitor } from '@/lib/previewPerformance'

export function usePlayback(
  videoRef: RefObject<HTMLVideoElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  {
    canvasSize,
    renderOutputSize,
    renderSettings,
    keyframes,
    ripples,
    keyPrompts,
    keyboardOverlay,
    cuts,
    fallbackDurationMs,
    sourceFps,
    performanceMonitoring,
    onPerformanceIssue
  }: PlaybackOptions
): Playback {
  const compositorRef = useRef<Compositor | null>(null)
  const animatorRef = useRef<ReturnType<typeof createCameraAnimator> | null>(null)
  const rvfcRef = useRef(0)
  const lastMsRef = useRef(0)
  const ripplesRef = useRef(ripples)
  ripplesRef.current = ripples
  const keyPromptsRef = useRef(keyPrompts)
  keyPromptsRef.current = keyPrompts
  const keyboardOverlayRef = useRef(keyboardOverlay)
  keyboardOverlayRef.current = keyboardOverlay
  const renderOutputSizeRef = useRef(renderOutputSize)
  renderOutputSizeRef.current = renderOutputSize
  const cutsRef = useRef(cuts)
  cutsRef.current = normalizeCuts(cuts)
  const skippingRef = useRef(false)
  const probingRef = useRef(false)
  const renderInfoRef = useRef<RenderInfo | null>(null)
  const progressListenersRef = useRef(new Set<(currentMs: number) => void>())
  const lastUiProgressAtRef = useRef(-Infinity)
  const performanceMonitorRef = useRef(new PreviewPerformanceMonitor())
  const performanceOptionsRef = useRef({ sourceFps, performanceMonitoring, onPerformanceIssue })
  performanceOptionsRef.current = { sourceFps, performanceMonitoring, onPerformanceIssue }
  const [playing, setPlaying] = useState(false)
  const [currentMs, setCurrentMs] = useState(0)
  const [durationMs, setDurationMs] = useState(0)
  const [renderInfo, setRenderInfo] = useState<RenderInfo | null>(null)
  const [playbackError, setPlaybackError] = useState<string | null>(null)

  const publishCurrentMs = useCallback((tMs: number, forceReact = false) => {
    for (const listener of progressListenersRef.current) listener(tMs)
    const now = performance.now()
    if (forceReact || now - lastUiProgressAtRef.current >= 50) {
      lastUiProgressAtRef.current = now
      setCurrentMs(tMs)
    }
  }, [])

  const subscribeCurrentMs = useCallback((listener: (currentMs: number) => void) => {
    progressListenersRef.current.add(listener)
    return () => {
      progressListenersRef.current.delete(listener)
    }
  }, [])
  const draw = useCallback(
    (tMs: number) => {
      const video = videoRef.current
      const comp = compositorRef.current
      const anim = animatorRef.current
      if (!video || !comp || !anim || video.readyState < 2) return
      const output = renderOutputSizeRef.current
      const overlay = output
        ? keyOverlayFrameAt(keyPromptsRef.current, tMs, keyboardOverlayRef.current, output)
        : null
      const next = comp.drawFrame(video, anim.sample(), tMs, ripplesRef.current, overlay)
      if (!sameRenderInfo(renderInfoRef.current, next)) {
        renderInfoRef.current = next
        setRenderInfo(next)
      }
      const perf = performanceOptionsRef.current
      if (!perf.performanceMonitoring || video.paused || document.visibilityState !== 'visible') {
        performanceMonitorRef.current.reset()
      } else if (performanceMonitorRef.current.sample(performance.now(), tMs, perf.sourceFps)) {
        perf.onPerformanceIssue()
      }
    },
    [videoRef]
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !canvasSize || !renderOutputSize) return
    try {
      const outputPlan = resolveOutputPlan(canvasSize, renderSettings)
      const comp = new Compositor(canvas, previewCompositorConfig(renderOutputSize, {
        background: { color: hexToRgba(outputPlan.backgroundColor) },
        videoStyle: { paddingRatio: outputPlan.paddingRatio }
      }))
      comp.setCanvasSize(canvasSize)
      compositorRef.current = comp
      renderInfoRef.current = null
      performanceMonitorRef.current.reset()
      setPlaybackError(null)
      draw(lastMsRef.current)
      return () => {
        comp.dispose()
        compositorRef.current = null
        renderInfoRef.current = null
      }
    } catch (err) {
      setPlaybackError(
        `合成器初始化失败: ${err instanceof Error ? err.message : String(err)}`
      )
      return
    }
  }, [canvasRef, canvasSize, draw, renderOutputSize, renderSettings])

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

  const onFrame = useCallback(
    function frame() {
      const video = videoRef.current
      if (!video || video.paused) return
      if (!skippingRef.current) {
        const tMs = video.currentTime * 1000
        // 裁剪区跳过：seek 到保留段起点（音轨经 seeked 自动跟随对齐）
        const cut = cutAt(tMs, cutsRef.current)
        if (cut !== null) {
          const rawEnd = Number.isFinite(video.duration)
            ? video.duration * 1000
            : fallbackDurationMs
          if (cut.endMs >= rawEnd - 50) {
            // 裁剪区直达片尾：停在保留段最后一帧，而不是 seek 到片尾显示被裁内容
            video.pause()
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
          draw(tMs)
          publishCurrentMs(tMs)
        }
      }
      rvfcRef.current = video.requestVideoFrameCallback(frame)
    },
    [videoRef, draw, publishCurrentMs]
  )

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    return attachPlaybackVideoEvents({
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
    })
  }, [videoRef, draw, cancelLoop, fallbackDurationMs, publishCurrentMs])

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
      const rawEnd = Number.isFinite(video.duration) ? video.duration * 1000 : fallbackDurationMs
      if (video.ended || isPlaybackAtCutEnd(video.currentTime * 1000, rawEnd, cutsRef.current)) {
        video.currentTime = 0
      }
      // 当前位置落在裁剪区时先跳走；裁剪区直达片尾（已在有效结尾）则从头再播
      const cut = cutAt(video.currentTime * 1000, cutsRef.current)
      if (cut !== null) {
        video.currentTime = (cut.endMs >= rawEnd - 50 ? 0 : cut.endMs) / 1000
      }
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

  const seekTo = useCallback(
    (ms: number) => {
      const video = videoRef.current
      if (!video) return
      // duration=Infinity（webm 无 Duration 元数据）时用事件时间轴估计时长做钳制上限
      const durMs = Number.isFinite(video.duration)
        ? video.duration * 1000
        : fallbackDurationMs
      const tMs = Math.max(0, durMs > 0 ? Math.min(ms, durMs) : ms)
      // 目标落在裁剪区时吸附：中间段跳到保留段起点；直达片尾的尾部段回到其起点（有效结尾）
      const target = snapSeekTimeToCuts(tMs, durMs, cutsRef.current)
      video.currentTime = target / 1000
      lastMsRef.current = target
      animatorRef.current?.reset(target)
      publishCurrentMs(target, true)
      draw(target)
    },
    [videoRef, draw, fallbackDurationMs, publishCurrentMs]
  )

  useEffect(() => {
    const video = videoRef.current
    if (!video || video.readyState < 1) return
    const cut = cutAt(video.currentTime * 1000, cutsRef.current)
    if (cut === null) return
    const rawEnd = Number.isFinite(video.duration)
      ? video.duration * 1000
      : fallbackDurationMs
    const target = cut.endMs >= rawEnd - 50 ? cut.startMs : cut.endMs
    video.currentTime = target / 1000
    lastMsRef.current = target
    animatorRef.current?.reset(target)
    publishCurrentMs(target, true)
    draw(target)
  }, [cuts, videoRef, draw, fallbackDurationMs, publishCurrentMs])

  return {
    playing,
    currentMs,
    durationMs,
    renderInfo,
    playbackError,
    togglePlay,
    seekTo,
    subscribeCurrentMs
  }
}
