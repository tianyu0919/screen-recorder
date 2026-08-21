import { useEffect, useRef } from 'react'
import type { CameraKeyframe } from '@shared/types'
import type { Timeline } from '@/timeline/types'
import type { RipplePoint } from '@/render/types'
import { usePlayback } from './usePlayback'
import { useSyncedAudio } from './useSyncedAudio'
import { PlayerTimeline } from './PlayerTimeline'
import { usePreviewStore } from '@/store/previewStore'

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
  ripples
}: PreviewPlayerProps): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cuts = usePreviewStore((s) => s.cuts)
  const { playing, currentMs, durationMs, renderInfo, playbackError, togglePlay, seekTo } = usePlayback(
    videoRef,
    canvasRef,
    {
      canvasSize: timeline.canvas,
      keyframes,
      ripples,
      cuts,
      // webm 无 Duration 元数据时 video.duration=Infinity，回退到事件时间轴估计时长
      fallbackDurationMs: timeline.durationMs
    }
  )
  const noMotion = timeline.events.clicks.length === 0
  // 麦克风/系统音频双轨：各自跟随 video 同步（逻辑见 useSyncedAudio）；
  // system 轨带回声对齐偏移（音箱外放时 mic 会录入系统音，见 lib/audioAlign.ts）
  const micAudioRef = useSyncedAudio(videoRef, audioUrl)
  const systemAudioRef = useSyncedAudio(videoRef, systemAudioUrl, systemAudioOffsetSec)

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

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* 舞台：合成画布居中，四周留出暗色背景（即导出时的"边距背景"区域） */}
      <div
        className="grid min-h-0 flex-1 place-items-center overflow-hidden p-5"
        style={{
          background:
            'radial-gradient(900px 500px at 30% 20%, rgba(255,92,56,0.05), transparent 60%), linear-gradient(160deg, #17171b 0%, #0c0c0f 80%)'
        }}
      >
        <canvas
          ref={canvasRef}
          className="max-h-full max-w-full rounded-xl border border-line-strong shadow-[0_30px_80px_rgba(0,0,0,0.6),0_4px_16px_rgba(0,0,0,0.4)]"
        />
        {/* 帧源：隐藏 video，由合成器逐帧取样绘制到 canvas */}
        <video ref={videoRef} preload="auto" muted className="hidden" />
        {/* 麦克风/系统音频轨：跟随 video 同步播放（screen.webm 本身无音轨） */}
        {audioUrl && <audio ref={micAudioRef} preload="auto" className="hidden" />}
        {systemAudioUrl && <audio ref={systemAudioRef} preload="auto" className="hidden" />}
      </div>

      {(noMotion || renderInfo?.downsampled || playbackError) && (
        <div className="flex flex-none flex-col gap-1.5 px-4 pb-2">
          {noMotion && (
            <p className="rounded-lg bg-amber-950/50 px-3 py-2 text-xs text-amber-300">
              无运镜数据：本会话未采集到点击事件，相机全程保持 1.0x 全景。
            </p>
          )}
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

      <PlayerTimeline
        playing={playing}
        currentMs={currentMs}
        durationMs={durationMs}
        keyframes={keyframes}
        events={timeline.events}
        onTogglePlay={togglePlay}
        onSeek={seekTo}
      />
    </div>
  )
}
