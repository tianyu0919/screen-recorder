import { useEffect, useRef, useState } from 'react'
import { Maximize2, Minimize2, Pause, Play, X } from 'lucide-react'
import type { CutRange } from '@/timeline/cuts'
import { effectiveDurationMs, outputToSourceMs, sourceToOutputMs } from '@/timeline/cuts'
import { formatMs } from '@/timeline/ticks'
import { cn } from '@/lib/utils'
import { useWindowMaximized } from '@/hooks/useWindowMaximized'

interface FocusPreviewControlsProps {
  playing: boolean
  currentMs: number
  durationMs: number
  cuts: CutRange[]
  onTogglePlay(): void
  onSeek(ms: number): void
  onExit(): void
}

const AUTO_HIDE_MS = 2000

/** 专注预览的只读媒体控制；播放时无操作 2 秒自动隐藏。 */
export function FocusPreviewControls(props: FocusPreviewControlsProps): React.JSX.Element {
  const { maximized, toggleMaximized } = useWindowMaximized()
  const [visible, setVisible] = useState(true)
  const visibleRef = useRef(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const interactingRef = useRef(false)

  const clearTimer = (): void => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
  }
  const setControlsVisible = (next: boolean): void => {
    visibleRef.current = next
    setVisible(next)
  }
  const scheduleHide = (): void => {
    clearTimer()
    if (!props.playing || interactingRef.current) return
    timerRef.current = setTimeout(() => setControlsVisible(false), AUTO_HIDE_MS)
  }

  useEffect(() => {
    const reveal = (): void => {
      if (!visibleRef.current) setControlsVisible(true)
      scheduleHide()
    }
    window.addEventListener('pointermove', reveal, { passive: true })
    if (props.playing) scheduleHide()
    else {
      clearTimer()
      setControlsVisible(true)
    }
    return () => {
      window.removeEventListener('pointermove', reveal)
      clearTimer()
    }
  }, [props.playing])

  const outputDuration = effectiveDurationMs(props.durationMs, props.cuts)
  const outputCurrent = Math.min(outputDuration, sourceToOutputMs(props.currentMs, props.cuts))
  const enterControls = (): void => {
    interactingRef.current = true
    clearTimer()
    setControlsVisible(true)
  }
  const leaveControls = (): void => {
    interactingRef.current = false
    scheduleHide()
  }

  return (
    <div
      role="group"
      aria-label="专注预览播放控制"
      onPointerEnter={enterControls}
      onPointerLeave={leaveControls}
      onFocusCapture={enterControls}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) leaveControls()
      }}
      className={cn(
        'app-nodrag absolute bottom-6 left-1/2 z-20 flex w-[min(680px,calc(100%-32px))] -translate-x-1/2 items-center gap-3 rounded-2xl border border-white/10 bg-canvas-raised p-2.5 text-on-accent shadow-float transition-[opacity,transform] duration-200',
        visible
          ? 'translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-2 opacity-0'
      )}
    >
      <button
        type="button"
        onClick={props.onTogglePlay}
        disabled={props.durationMs <= 0}
        aria-label={props.playing ? '暂停' : '播放'}
        aria-pressed={props.playing}
        className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-accent text-on-accent transition-[transform,background-color] hover:bg-accent-hover active:scale-95 disabled:opacity-40"
      >
        {props.playing ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <input
          type="range"
          min={0}
          max={Math.max(1, outputDuration)}
          step={10}
          value={outputCurrent}
          onChange={(event) => props.onSeek(outputToSourceMs(Number(event.target.value), props.cuts))}
          aria-label="预览播放进度"
          aria-valuetext={`${formatMs(outputCurrent)} / ${formatMs(outputDuration)}`}
          className="ui-slider w-full"
        />
        <div className="flex justify-between font-mono text-[11px] tabular-nums text-on-accent/60">
          <span>{formatMs(outputCurrent)}</span>
          <span>{formatMs(outputDuration)}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={toggleMaximized}
        aria-label={maximized ? '还原窗口' : '最大化窗口'}
        title={maximized ? '还原窗口' : '最大化到屏幕工作区'}
        className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-white/10 text-on-accent transition-[transform,background-color] hover:bg-white/15 active:scale-95"
      >
        {maximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
      </button>

      <button
        type="button"
        onClick={props.onExit}
        aria-label="退出专注预览"
        title="退出专注预览 (Esc)"
        className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-white/10 text-on-accent transition-[transform,background-color] hover:bg-white/15 active:scale-95"
      >
        <X size={18} />
      </button>
    </div>
  )
}
