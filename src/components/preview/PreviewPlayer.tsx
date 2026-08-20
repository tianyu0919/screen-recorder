import { useEffect, useRef } from 'react'
import type { CameraKeyframe } from '@shared/types'
import type { Timeline } from '@/timeline/types'
import type { RipplePoint } from '@/render/types'
import { Button } from '@/components/ui/button'
import { usePlayback } from './usePlayback'
import { useSyncedAudio } from './useSyncedAudio'

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, '0')
  const s = (total % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

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
 * 预览播放器（Task 3.1/3.2）：WebGL 合成画布 + 隐藏 <video> 帧源 + 播放/暂停/进度条。
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
  const { playing, currentMs, durationMs, renderInfo, playbackError, togglePlay, seekTo } = usePlayback(
    videoRef,
    canvasRef,
    {
      canvasSize: timeline.canvas,
      keyframes,
      ripples,
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
    <div className="flex flex-col gap-3">
      <canvas ref={canvasRef} className="aspect-video w-full rounded-lg border border-zinc-800" />
      {/* 帧源：隐藏 video，由合成器逐帧取样绘制到 canvas */}
      <video ref={videoRef} preload="auto" muted className="hidden" />
      {/* 麦克风/系统音频轨：跟随 video 同步播放（screen.webm 本身无音轨） */}
      {audioUrl && <audio ref={micAudioRef} preload="auto" className="hidden" />}
      {systemAudioUrl && <audio ref={systemAudioRef} preload="auto" className="hidden" />}

      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={togglePlay} disabled={durationMs === 0}>
          {playing ? '⏸ 暂停' : '▶ 播放'}
        </Button>
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.round(durationMs))}
          value={Math.min(Math.round(currentMs), Math.max(1, Math.round(durationMs)))}
          onChange={(e) => seekTo(Number(e.target.value))}
          disabled={durationMs === 0}
          className="h-1 flex-1 cursor-pointer accent-zinc-300"
        />
        <span className="font-mono text-xs text-zinc-400">
          {formatTime(currentMs)} / {formatTime(durationMs)}
        </span>
      </div>

      {noMotion && (
        <p className="rounded bg-amber-950/50 px-3 py-2 text-xs text-amber-300">
          无运镜数据：本会话未采集到点击事件，相机全程保持 1.0x 全景。
        </p>
      )}
      {renderInfo?.downsampled && (
        <p className="rounded bg-amber-950/50 px-3 py-2 text-xs text-amber-300">
          源视频 {renderInfo.sourceWidth}×{renderInfo.sourceHeight} 超出纹理上限（
          {renderInfo.textureLimit}px），已降采样至 {renderInfo.textureWidth}×
          {renderInfo.textureHeight}，输出仍为 {renderInfo.outputWidth}×{renderInfo.outputHeight}。
        </p>
      )}

      {playbackError && (
        <p className="rounded bg-red-950/50 px-3 py-2 text-sm text-red-300">{playbackError}</p>
      )}
    </div>
  )
}
