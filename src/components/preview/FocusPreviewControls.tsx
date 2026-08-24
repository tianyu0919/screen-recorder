import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Maximize2, Minimize2, Pause, Play, X } from 'lucide-react'
import type { CutRange } from '@/timeline/cuts'
import { effectiveDurationMs, outputToSourceMs, sourceToOutputMs } from '@/timeline/cuts'
import { formatMs } from '@/timeline/ticks'
import { cn } from '@/lib/utils'
import { useWindowMaximized } from '@/hooks/useWindowMaximized'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

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
  const progressPercent = outputDuration > 0 ? (outputCurrent / outputDuration) * 100 : 0
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
        'focus-preview-controls app-nodrag absolute bottom-5 left-1/2 z-20 flex w-[min(660px,calc(100%-32px))] -translate-x-1/2 items-center gap-2 rounded-[18px] p-1.5 text-white transition-[opacity,transform] duration-200 motion-reduce:transition-none',
        visible
          ? 'translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-1.5 opacity-0'
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={props.onTogglePlay}
            disabled={props.durationMs <= 0}
            aria-label={props.playing ? '暂停' : '播放'}
            aria-pressed={props.playing}
            className="grid h-11 w-11 flex-none cursor-pointer place-items-center rounded-full bg-accent text-on-accent shadow-[0_8px_24px_rgba(240,82,45,0.32)] transition-[transform,background-color,box-shadow] duration-150 hover:scale-[1.03] hover:bg-accent-hover hover:shadow-[0_10px_28px_rgba(240,82,45,0.4)] active:scale-95 disabled:cursor-default disabled:opacity-40 motion-reduce:transform-none"
          >
            {props.playing
              ? <Pause aria-hidden="true" size={17} strokeWidth={2.2} />
              : <Play aria-hidden="true" className="translate-x-px" size={17} fill="currentColor" />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={10} collisionPadding={12}>
          {props.playing ? '暂停（Space）' : '播放（Space）'}
        </TooltipContent>
      </Tooltip>

      <div className="flex min-w-0 flex-1 items-center gap-3 px-2">
        <span className="w-[42px] flex-none font-mono text-[11px] font-medium tabular-nums text-white/90">
          {formatMs(outputCurrent)}
        </span>
        <input
          type="range"
          min={0}
          max={Math.max(1, outputDuration)}
          step={10}
          value={outputCurrent}
          disabled={outputDuration <= 0}
          onChange={(event) => props.onSeek(outputToSourceMs(Number(event.target.value), props.cuts))}
          aria-label="预览播放进度"
          aria-valuetext={`${formatMs(outputCurrent)} / ${formatMs(outputDuration)}`}
          className="focus-preview-slider min-w-0 flex-1"
          style={{ '--focus-progress': `${progressPercent}%` } as CSSProperties}
        />
        <span className="w-[42px] flex-none text-right font-mono text-[11px] tabular-nums text-white/55">
          {formatMs(outputDuration)}
        </span>
      </div>

      <span aria-hidden="true" className="mx-0.5 h-7 w-px flex-none bg-white/10" />

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={toggleMaximized}
            aria-label={maximized ? '还原窗口' : '最大化窗口'}
            className="grid h-11 w-11 flex-none cursor-pointer place-items-center rounded-xl text-white/65 transition-[color,background-color,transform] duration-150 hover:bg-white/[0.09] hover:text-white active:scale-95 motion-reduce:transform-none"
          >
            {maximized
              ? <Minimize2 aria-hidden="true" size={17} strokeWidth={1.9} />
              : <Maximize2 aria-hidden="true" size={17} strokeWidth={1.9} />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={10} collisionPadding={12}>
          {maximized ? '还原窗口' : '最大化到屏幕工作区'}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={props.onExit}
            aria-label="退出专注预览"
            className="grid h-11 w-11 flex-none cursor-pointer place-items-center rounded-xl text-white/65 transition-[color,background-color,transform] duration-150 hover:bg-white/[0.09] hover:text-white active:scale-95 motion-reduce:transform-none"
          >
            <X aria-hidden="true" size={18} strokeWidth={1.9} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={10} collisionPadding={12}>
          退出专注预览（Esc）
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
