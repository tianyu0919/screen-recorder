import { useEffect, useMemo, useRef } from 'react'
import type { CameraKeyframe } from '@shared/types'
import type { Timeline } from '@/timeline/types'
import type { RipplePoint } from '@/render/types'
import { usePlayback } from './usePlayback'
import { useSyncedAudio } from './useSyncedAudio'
import { useClipsAudio } from './useClipsAudio'
import { PlayerTimeline } from './PlayerTimeline'
import { usePreviewStore } from '@/store/previewStore'
import { useStageFit } from './useStageFit'
import type { PreviewScaleMode } from '@/lib/stageFit'
import {
  MAX_FOCUS_PREVIEW_RENDER_SIZE,
  previewQualityProfile,
  previewRenderSize
} from '@/lib/stageFit'
import { cn } from '@/lib/utils'
import { KeyboardOverlayHandle } from './KeyboardOverlayHandle'
import { resolveOutputPlan } from '@/render/outputPlan'
import { FocusPreviewControls } from './FocusPreviewControls'
import { blocksGlobalShortcut } from '@/lib/keyboardTarget'
import type { PreviewQualityMode } from '@shared/types'

interface PreviewPlayerProps {
  timeline: Timeline
  videoUrl: string
  /** mic.wav 流式 URL（无麦克风轨为 null），预览时与画面同步播放 */
  audioUrl: string | null
  /** system.wav 流式 URL（无系统音频轨为 null），预览时与画面同步播放 */
  systemAudioUrl: string | null
  /** system 轨回声对齐偏移（秒），仅作用于 system 轨 */
  systemAudioOffsetSec: number
  keyframes: CameraKeyframe[]
  ripples: RipplePoint[]
  scaleMode: PreviewScaleMode
  quality: PreviewQualityMode
  focusMode: boolean
  onPerformanceIssue(): void
  onExitFocus(): void
}

/**
 * 预览播放器（Task 3.1/3.2）：WebGL 合成画布舞台 + 隐藏 <video> 帧源 + 底部时间轴。
 * 降采样与"无运镜数据"提示在此呈现（数据来自 RenderInfo 与会话 clicks）。
 * screen.webm 无音轨（麦克风/系统音频单独落盘 wav），预览用 <audio> 跟随 video 同步播放。
 */
export function PreviewPlayer({
  timeline,
  videoUrl,
  audioUrl,
  systemAudioUrl,
  systemAudioOffsetSec,
  keyframes,
  ripples,
  scaleMode,
  quality,
  focusMode,
  onPerformanceIssue,
  onExitFocus
}: PreviewPlayerProps): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderSettings = usePreviewStore((s) => s.renderSettings)
  const outputPlan = useMemo(
    () => resolveOutputPlan(timeline.canvas, renderSettings),
    [renderSettings, timeline.canvas]
  )
  const outputSize = outputPlan.output
  const { stageRef, canvasSize } = useStageFit(focusMode ? 'fit' : scaleMode, outputSize)
  const renderOutputSize = useMemo(() => {
    const profile = previewQualityProfile(quality, window.devicePixelRatio || 1)
    const pixelRatio = focusMode ? Math.min(2, window.devicePixelRatio || 1) : profile.pixelRatio
    const size = previewRenderSize(
      canvasSize,
      outputSize,
      focusMode ? MAX_FOCUS_PREVIEW_RENDER_SIZE : profile.maxSize,
      64,
      pixelRatio
    )
    return size.width > 0 && size.height > 0 ? size : null
  }, [canvasSize.height, canvasSize.width, focusMode, outputSize, quality])
  const cuts = usePreviewStore((s) => s.cuts)
  const keyPrompts = usePreviewStore((s) => s.keyPrompts)
  const keyboardOverlay = usePreviewStore((s) => s.keyboardOverlay)
  const setKeyboardOverlay = usePreviewStore((s) => s.setKeyboardOverlay)
  const setSourceDurationMs = usePreviewStore((s) => s.setSourceDurationMs)
  const {
    playing,
    currentMs,
    durationMs,
    renderInfo,
    playbackError,
    togglePlay,
    seekTo,
    subscribeCurrentMs
  } = usePlayback(videoRef, canvasRef, {
      canvasSize: timeline.canvas,
      renderOutputSize,
      renderSettings,
      keyframes,
      ripples,
      keyPrompts,
      keyboardOverlay,
      cuts,
      sourceFps: timeline.events.video.fps,
      performanceMonitoring: !focusMode && quality !== 'smooth',
      onPerformanceIssue,
      // webm 无 Duration 元数据时 video.duration=Infinity，回退到事件时间轴估计时长
      fallbackDurationMs: timeline.durationMs
    })
  useEffect(() => {
    if (durationMs > 0) setSourceDurationMs(durationMs)
  }, [durationMs, setSourceDurationMs])

  const noMotion = keyframes.every((keyframe) => keyframe.target.zoom <= 1.05)
  const motionEnabled = usePreviewStore((s) => s.motionEnabled)
  // 麦克风/系统音频双轨：各自跟随 video 同步（逻辑见 useSyncedAudio）；
  // system 轨带回声对齐偏移（音箱外放时 mic 会录入系统音，见 lib/audioAlign.ts）；
  // 音量增益来自检查器「音频」滑杆，实时生效
  const audioGain = usePreviewStore((s) => s.audioGain)
  const audioMute = usePreviewStore((s) => s.audioMute)
  const micAudioRef = useSyncedAudio(videoRef, audioUrl, 0, audioMute.mic ? 0 : audioGain.mic)
  const systemAudioRef = useSyncedAudio(
    videoRef,
    systemAudioUrl,
    systemAudioOffsetSec,
    audioMute.system ? 0 : audioGain.system
  )
  // 自定义音轨（波形块拖拽定位）：区间播放，锚定源时间轴
  const customClips = usePreviewStore((s) => s.customClips)
  useClipsAudio(videoRef, customClips)

  // React 有时不会把 media:// 自定义协议的 src 写到 <video> 属性上，直接赋值更可靠。
  // load() 必须只在 src 变化时调用：StrictMode/重渲染下重复 load() 会中断进行中的
  // 同名 URL 请求，触发 Chromium demuxer 的 data source error（code=4 Format error）
  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoUrl) return
    if (video.src !== videoUrl) {
      video.src = videoUrl
      video.load()
    }
  }, [videoUrl])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.repeat || blocksGlobalShortcut(event.target)) return
      if (event.code === 'Space') {
        event.preventDefault()
        togglePlay()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlay])

  return (
    <div className={cn('relative flex min-h-0 min-w-0 flex-1 flex-col', focusMode && 'bg-canvas')}>
      {/* 舞台：合成画布居中；整体作为圆角浮层卡片，四周留边距（两主题下都成立） */}
      <div
        className={cn(
          'relative min-h-0 flex-1 overflow-hidden bg-canvas',
          focusMode
            ? 'm-0 p-4'
            : 'mx-6 mb-6 mt-1 rounded-[20px] border border-line-strong p-5 shadow-card'
        )}
      >
        <div
          ref={stageRef}
          className={cn(
            'h-full w-full',
            scaleMode === 'actual' ? 'overflow-auto' : 'overflow-hidden'
          )}
        >
          <div
            className="grid min-h-full min-w-full place-items-center"
            style={
              scaleMode === 'actual'
                ? { width: outputSize.width, height: outputSize.height }
                : undefined
            }
          >
            <div
              className="relative flex-none"
              style={{ width: canvasSize.width, height: canvasSize.height }}
            >
              <canvas
                ref={canvasRef}
                className={cn('h-full w-full', !focusMode && 'border border-line-strong')}
              />
              {!focusMode && (
                <KeyboardOverlayHandle
                  position={keyboardOverlay}
                  onChange={setKeyboardOverlay}
                />
              )}
            </div>
            {/* 帧源：隐藏 video，由合成器逐帧取样绘制到 canvas */}
            <video ref={videoRef} preload="auto" muted className="hidden" />
            {/* 麦克风/系统音频轨：跟随 video 同步播放（screen.webm 本身无音轨） */}
            {audioUrl && <audio ref={micAudioRef} preload="auto" className="hidden" />}
            {systemAudioUrl && <audio ref={systemAudioRef} preload="auto" className="hidden" />}
          </div>
        </div>
        {!focusMode && noMotion && (
          <p
            role="status"
            className="pointer-events-none absolute bottom-3 left-1/2 z-10 flex max-w-[calc(100%_-_24px)] -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-line-strong bg-surface-1/90 px-3 py-1.5 text-[11px] text-ink-2 shadow-card backdrop-blur-sm"
          >
            <span className="h-1.5 w-1.5 flex-none rounded-full bg-warning" aria-hidden="true" />
            {motionEnabled
              ? '无运镜数据，画面保持 1.0x 全景'
              : '运镜已关闭，画面保持 1.0x 全景'}
          </p>
        )}
      </div>

      {!focusMode && <div className="flex flex-none items-center justify-end px-6 pb-2 font-mono text-[10.5px] text-ink-3">
        输出 {outputSize.width}×{outputSize.height}
      </div>}

      {!focusMode && (renderInfo?.downsampled || playbackError) && (
        <div className="flex flex-none flex-col gap-1.5 px-6 pb-2">
          {renderInfo?.downsampled && (
            <p className="rounded-lg bg-amber-950/50 px-3 py-2 text-xs text-amber-300">
              源视频 {renderInfo.sourceWidth}×{renderInfo.sourceHeight} 超出纹理上限（
              {renderInfo.textureLimit}px），已降采样至 {renderInfo.textureWidth}×
              {renderInfo.textureHeight}，输出仍为 {renderInfo.outputWidth}×{renderInfo.outputHeight}。
            </p>
          )}
          {playbackError && (
            <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300">
              {playbackError}
            </p>
          )}
        </div>
      )}

      {focusMode ? (
        <>
          {playbackError && (
            <p role="alert" className="absolute left-1/2 top-5 z-20 -translate-x-1/2 rounded-xl bg-danger px-4 py-2 text-sm text-on-accent shadow-float">
              {playbackError}
            </p>
          )}
          <FocusPreviewControls
            playing={playing}
            currentMs={currentMs}
            durationMs={durationMs}
            cuts={cuts}
            onTogglePlay={togglePlay}
            onSeek={seekTo}
            onExit={onExitFocus}
          />
        </>
      ) : (
        <PlayerTimeline
          playing={playing}
          currentMs={currentMs}
          durationMs={durationMs}
          onTogglePlay={togglePlay}
          onSeek={seekTo}
          subscribeCurrentMs={subscribeCurrentMs}
        />
      )}
    </div>
  )
}
