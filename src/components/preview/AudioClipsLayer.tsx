import { memo, useEffect, useMemo, useRef } from 'react'
import type { CustomClip } from '@/store/previewStore'
import {
  audioClipDurationMs,
  MIN_AUDIO_CLIP_MS,
  shiftAudioClipSourceWindow
} from '@/lib/audioClip'
import type { TimelineMenuTarget } from './TimelineContextMenu'

interface AudioClipsLayerProps {
  clips: CustomClip[]
  /** 源时间轴总长 ms（定位/宽度换算基准） */
  duration: number
  /** 当前缩放下每秒像素数（拖拽 delta px → ms 换算） */
  pxPerSec: number
  onOffsetChange(id: string, offsetMs: number): void
  onTrimChange(
    id: string,
    patch: Partial<Pick<CustomClip, 'offsetMs' | 'trimStartMs' | 'trimEndMs'>>
  ): void
  onCommit(): void
  onContextMenu(event: React.MouseEvent, tMs: number, target: TimelineMenuTarget): void
}

/** 峰值包络 → SVG 竖线路径（居中对称波形） */
function peaksPath(peaks: number[]): string {
  const mid = 18
  return peaks
    .map((p, i) => {
      const h = Math.max(1.5, p * 32)
      return `M${i + 0.5} ${(mid - h / 2).toFixed(1)}V${(mid + h / 2).toFixed(1)}`
    })
    .join(' ')
}

function formatSourceTime(ms: number): string {
  const totalTenths = Math.max(0, Math.round(ms / 100))
  const minutes = Math.floor(totalTenths / 600)
  const seconds = Math.floor((totalTenths % 600) / 10)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${totalTenths % 10}`
}

function ClipBlock({
  clip,
  duration,
  pxPerSec,
  onOffsetChange,
  onTrimChange,
  onCommit,
  onContextMenu
}: {
  clip: CustomClip
  duration: number
  pxPerSec: number
  onOffsetChange: AudioClipsLayerProps['onOffsetChange']
  onTrimChange: AudioClipsLayerProps['onTrimChange']
  onCommit: AudioClipsLayerProps['onCommit']
  onContextMenu: AudioClipsLayerProps['onContextMenu']
}): React.JSX.Element {
  const drag = useRef<{
    mode: 'move' | 'trim-l' | 'trim-r'
    startX: number
    clip: CustomClip
  } | null>(null)
  const blockRef = useRef<HTMLDivElement>(null)
  const wheelCommitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const workingClip = useRef(clip)
  const onCommitRef = useRef(onCommit)
  const onTrimChangeRef = useRef(onTrimChange)
  const pxPerSecRef = useRef(pxPerSec)
  workingClip.current = clip
  onCommitRef.current = onCommit
  onTrimChangeRef.current = onTrimChange
  pxPerSecRef.current = pxPerSec

  useEffect(() => {
    const element = blockRef.current
    if (!element) return
    const handleWheel = (event: WheelEvent): void => {
      const scale = pxPerSecRef.current
      if (event.ctrlKey || Math.abs(event.deltaX) <= Math.abs(event.deltaY) || scale <= 0) return
      event.preventDefault()
      event.stopPropagation()
      const current = workingClip.current
      const range = shiftAudioClipSourceWindow(current, (event.deltaX / scale) * 1000)
      if (range.trimStartMs === current.trimStartMs && range.trimEndMs === current.trimEndMs) return
      workingClip.current = { ...current, ...range }
      onTrimChangeRef.current(current.id, range)
      if (wheelCommitTimer.current) clearTimeout(wheelCommitTimer.current)
      wheelCommitTimer.current = setTimeout(() => {
        wheelCommitTimer.current = null
        onCommitRef.current()
      }, 180)
    }
    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      element.removeEventListener('wheel', handleWheel)
      if (!wheelCommitTimer.current) return
      clearTimeout(wheelCommitTimer.current)
      onCommitRef.current()
    }
  }, [])
  const clipDuration = audioClipDurationMs(clip)
  const maxOffset = Math.max(0, duration - clipDuration)
  const { visiblePeaks, waveformPath } = useMemo(() => {
    const startPeak = Math.floor((clip.trimStartMs / clip.sourceDurationMs) * clip.peaks.length)
    const endPeak = Math.ceil((clip.trimEndMs / clip.sourceDurationMs) * clip.peaks.length)
    const peaks = clip.peaks.slice(startPeak, Math.max(startPeak + 1, endPeak))
    return { visiblePeaks: peaks, waveformPath: peaksPath(peaks) }
  }, [clip.peaks, clip.sourceDurationMs, clip.trimEndMs, clip.trimStartMs])

  const beginDrag =
    (mode: 'move' | 'trim-l' | 'trim-r') =>
    (e: React.PointerEvent<HTMLElement>): void => {
      e.stopPropagation()
      e.currentTarget.setPointerCapture(e.pointerId)
      drag.current = { mode, startX: e.clientX, clip }
    }

  const onPointerMove = (e: React.PointerEvent<HTMLElement>): void => {
    const state = drag.current
    if (!state || pxPerSec <= 0) return
    const deltaMs = ((e.clientX - state.startX) / pxPerSec) * 1000
    const original = state.clip
    const originalDuration = audioClipDurationMs(original)
    const minDuration = Math.min(MIN_AUDIO_CLIP_MS, originalDuration)
    if (state.mode === 'move') {
      onOffsetChange(
        clip.id,
        Math.min(Math.max(0, original.offsetMs + deltaMs), maxOffset)
      )
    } else if (state.mode === 'trim-l') {
      const minOffset = Math.max(0, original.offsetMs - original.trimStartMs)
      const maxOffset = original.offsetMs + originalDuration - minDuration
      const offsetMs = Math.min(Math.max(minOffset, original.offsetMs + deltaMs), maxOffset)
      onTrimChange(clip.id, {
        offsetMs,
        trimStartMs: original.trimStartMs + offsetMs - original.offsetMs
      })
    } else {
      const minEnd = original.offsetMs + minDuration
      const maxEnd = Math.min(
        duration,
        original.offsetMs + original.sourceDurationMs - original.trimStartMs
      )
      const endMs = Math.min(
        Math.max(minEnd, original.offsetMs + originalDuration + deltaMs),
        maxEnd
      )
      onTrimChange(clip.id, {
        trimEndMs: original.trimStartMs + endMs - original.offsetMs
      })
    }
  }

  const endDrag = (e: React.PointerEvent<HTMLElement>): void => {
    const hadDrag = drag.current !== null
    drag.current = null
    const target = e.target as HTMLElement
    if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId)
    if (hadDrag) onCommit()
  }

  return (
    <div
      ref={blockRef}
      title={`${clip.name}（拖主体移动，拖左右边缘裁剪，左右滚动滑移素材）`}
      className="group absolute top-[7px] h-[34px] cursor-grab overflow-hidden rounded-md border border-line-strong bg-surface-2 text-ink-2 hover:border-accent active:cursor-grabbing"
      style={{
        left: `${(clip.offsetMs / duration) * 100}%`,
        width: `${(clipDuration / duration) * 100}%`
      }}
      onPointerDown={beginDrag('move')}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onContextMenu={(event) =>
        onContextMenu(event, clip.offsetMs, { kind: 'audio', id: clip.id })
      }
    >
      <svg
        className="h-full w-full"
        viewBox={`0 0 ${visiblePeaks.length} 36`}
        preserveAspectRatio="none"
      >
        <path d={waveformPath} stroke="currentColor" strokeWidth={1} fill="none" />
      </svg>
      <span className="pointer-events-none absolute left-1 top-0 max-w-full truncate text-[9px] leading-3 text-ink-3">
        {clip.name}
      </span>
      <span className="pointer-events-none absolute right-2 top-0 rounded-b bg-surface-2/90 px-1 font-mono text-[8.5px] leading-3 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100">
        {formatSourceTime(clip.trimStartMs)}–{formatSourceTime(clip.trimEndMs)}
      </span>
      <div
        aria-label="裁剪音频开头"
        className="absolute bottom-0 left-0 top-0 z-10 w-2 cursor-ew-resize border-l-2 border-accent bg-accent/10 opacity-50 transition-opacity group-hover:opacity-100"
        onPointerDown={beginDrag('trim-l')}
      />
      <div
        aria-label="裁剪音频结尾"
        className="absolute bottom-0 right-0 top-0 z-10 w-2 cursor-ew-resize border-r-2 border-accent bg-accent/10 opacity-50 transition-opacity group-hover:opacity-100"
        onPointerDown={beginDrag('trim-r')}
      />
    </div>
  )
}

/** 时间轴「音频」行：自定义音轨波形块，按住水平拖动调整起始位置（offsetMs） */
export const AudioClipsLayer = memo(function AudioClipsLayer({
  clips,
  duration,
  pxPerSec,
  onOffsetChange,
  onTrimChange,
  onCommit,
  onContextMenu
}: AudioClipsLayerProps): React.JSX.Element {
  if (clips.length === 0) {
    return (
      <span className="pointer-events-none absolute inset-0 grid place-items-center text-[10px] text-ink-3">
        右键时间轴添加自定义音轨（BGM / 旁白）
      </span>
    )
  }
  return (
    <>
      {clips.map((clip) => (
        <ClipBlock
          key={clip.id}
          clip={clip}
          duration={duration}
          pxPerSec={pxPerSec}
          onOffsetChange={onOffsetChange}
          onTrimChange={onTrimChange}
          onCommit={onCommit}
          onContextMenu={onContextMenu}
        />
      ))}
    </>
  )
})
