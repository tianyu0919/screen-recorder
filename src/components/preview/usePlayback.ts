import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { CameraKeyframe } from '@shared/types'
import type { CanvasSize } from '@/timeline/types'
import { createCameraAnimator } from '@/timeline/spring'
import { Compositor } from '@/render/compositor'
import type { RenderInfo, RipplePoint } from '@/render/types'
import { cutAt, normalizeCuts, type CutRange } from '@/timeline/cuts'

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
  /** 裁剪区间（源时间轴 ms）：播放时直接跳过 */
  cuts: CutRange[]
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
  { canvasSize, keyframes, ripples, cuts, fallbackDurationMs }: PlaybackOptions
): Playback {
  const compositorRef = useRef<Compositor | null>(null)
  const animatorRef = useRef<ReturnType<typeof createCameraAnimator> | null>(null)
  const rvfcRef = useRef(0)
  const lastMsRef = useRef(0)
  const ripplesRef = useRef(ripples)
  ripplesRef.current = ripples
  const cutsRef = useRef(cuts)
  cutsRef.current = normalizeCuts(cuts)
  /** 裁剪跳转进行中：seek 是异步的，完成前不再触发新跳转，否则连续 seek 卡死画面 */
  const skippingRef = useRef(false)
  /** 时长探针进行中（webm 无 Duration：先 seek 到极大时间点逼浏览器解析真实时长） */
  const probingRef = useRef(false)
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
            setCurrentMs(cut.startMs)
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
          setCurrentMs(tMs)
        }
      }
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
      // MediaRecorder webm 缺 Duration 元数据：探针 seek 解析真实时长，
      // 否则时间轴用事件估算长度，比真实视频长出一截死区（尾部 gap）
      if (!Number.isFinite(video.duration)) {
        probingRef.current = true
        video.currentTime = 1e7
      }
    }
    const onDurationChange = () => {
      syncDuration()
      // 探针拿到真实时长后回到起点（seeked 时再呈现首帧）
      if (probingRef.current && Number.isFinite(video.duration)) {
        probingRef.current = false
        video.currentTime = 0
      }
    }
    // 首帧可解码即呈现（loadedmetadata 时 readyState 可能仍 < 2）
    const onLoadedData = () => draw(video.currentTime * 1000)
    // seek 完成：用目标位置的新解码帧重绘（seekTo 已先用旧帧 + 新相机即时呈现）
    const onSeeked = () => {
      skippingRef.current = false
      // 探针 seek 落点是视频末帧，不呈现（durationchange 会接着把进度拉回 0）
      if (probingRef.current) return
      const tMs = video.currentTime * 1000
      lastMsRef.current = tMs
      draw(tMs)
    }
    const onEnded = () => {
      skippingRef.current = false
      cancelLoop(video)
      setPlaying(false)
      // MediaRecorder webm 无 Duration 元数据：播完才知真实时长。
      // 事件时间轴估计可能偏长（鼠标轨迹记到停止时刻），用真实片尾修正，
      // 否则播放头停在 ~96%，运镜片段尾巴也会多出估算值那一截
      const tMs = video.currentTime * 1000
      if (tMs > 0) {
        setDurationMs((prev) => (Math.abs(tMs - prev) > 200 ? tMs : prev))
        setCurrentMs(tMs)
      }
    }
    const onError = () => {
      setPlaybackError(
        `视频加载失败: code=${video.error?.code ?? '?'} ${video.error?.message ?? ''}`
      )
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
      // 当前位置落在裁剪区时先跳走；裁剪区直达片尾（已在有效结尾）则从头再播
      const cut = cutAt(video.currentTime * 1000, cutsRef.current)
      if (cut !== null) {
        const rawEnd = Number.isFinite(video.duration)
          ? video.duration * 1000
          : fallbackDurationMs
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
      // 目标落在裁剪区时吸附：中间段跳到保留段起点；直达片尾的尾部段回到其起点（有效结尾）
      const cut = cutAt(tMs, cutsRef.current)
      const target = cut ? (cut.endMs >= durMs - 50 ? cut.startMs : cut.endMs) : tMs
      video.currentTime = target / 1000
      lastMsRef.current = target
      animatorRef.current?.reset(target)
      setCurrentMs(target)
      draw(target)
    },
    [videoRef, draw, fallbackDurationMs]
  )

  /** 裁剪变化时（如新增的区间覆盖了当前位置）：暂停态也把播放头移出裁剪区 */
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
    setCurrentMs(target)
    draw(target)
  }, [cuts, videoRef, draw, fallbackDurationMs])

  return { playing, currentMs, durationMs, renderInfo, playbackError, togglePlay, seekTo }
}
