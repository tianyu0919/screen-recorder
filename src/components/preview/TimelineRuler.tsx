import { memo } from 'react'
import { formatMs, pickTickIntervalSec } from '@/timeline/ticks'

interface Props {
  duration: number
  contentWidth: number
  pxPerSec: number
  onPointerDown(event: React.PointerEvent<HTMLDivElement>): void
  onPointerMove(event: React.PointerEvent<HTMLDivElement>): void
  onPointerUp(event: React.PointerEvent<HTMLDivElement>): void
}

export const TimelineRuler = memo(function TimelineRuler({
  duration,
  contentWidth,
  pxPerSec,
  onPointerDown,
  onPointerMove,
  onPointerUp
}: Props): React.JSX.Element {
  const intervalSec = pickTickIntervalSec(pxPerSec || 1)
  const endLabel = formatMs(duration)
  const ticks: number[] = []
  for (let seconds = intervalSec; seconds * 1000 < duration; seconds += intervalSec) {
    const label = formatMs(seconds * 1000)
    const px = ((seconds * 1000) / duration) * contentWidth
    if (label !== endLabel && px + 34 < contentWidth - 38) ticks.push(seconds)
  }
  return (
    <div
      className="relative h-[22px] cursor-crosshair border-b border-line"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <span className="absolute left-0 top-0 h-full border-l border-line-strong" />
      <span className="absolute left-0 top-0 pl-1 font-mono text-[9.5px] leading-[22px] text-ink-3">
        00:00
      </span>
      {ticks.map((seconds) => (
        <span key={seconds}>
          <span
            className="absolute top-0 h-full border-l border-line-strong"
            style={{ left: `${((seconds * 1000) / duration) * 100}%` }}
          />
          <span
            className="absolute top-0 pl-1 font-mono text-[9.5px] leading-[22px] text-ink-3"
            style={{ left: `${((seconds * 1000) / duration) * 100}%` }}
          >
            {formatMs(seconds * 1000)}
          </span>
        </span>
      ))}
      <span className="absolute right-0 top-0 h-full border-r border-line-strong" />
      <span className="absolute right-0 top-0 pr-1 font-mono text-[9.5px] leading-[22px] text-ink-3">
        {endLabel}
      </span>
    </div>
  )
})
