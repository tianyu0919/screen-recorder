import { memo, useMemo, useRef } from 'react'
import type { CaptionSegment } from '@shared/captions'
import { cn } from '@/lib/utils'
import { usePreviewStore } from '@/store/previewStore'

interface CaptionsLayerProps {
  segments: CaptionSegment[]
  selectedId: string | null
  duration: number
  pxPerSec: number
  onSelect(id: string): void
  onSeek(tMs: number): void
  onRangeChange(id: string, startMs: number, endMs: number, commit: boolean): void
  onContextMenu(event: React.MouseEvent, tMs: number, id: string): void
}

type DragMode = 'move' | 'start' | 'end'

export const CaptionsLayer = memo(function CaptionsLayer(props: CaptionsLayerProps): React.JSX.Element {
  // TTS 溢出段标记（kr-08）：生成时变速超 ±20% 阈值的段，配音可能溢出/被截断
  const overflowIds = usePreviewStore((state) => state.ttsSettings?.overflowSegmentIds)
  const overflowSet = useMemo(() => new Set(overflowIds ?? []), [overflowIds])
  const dragRef = useRef<{
    id: string
    mode: DragMode
    startX: number
    startMs: number
    endMs: number
  } | null>(null)

  const begin = (event: React.PointerEvent, segment: CaptionSegment, mode: DragMode): void => {
    event.preventDefault()
    event.stopPropagation()
    props.onSelect(segment.id)
    props.onSeek(segment.startMs)
    dragRef.current = { id: segment.id, mode, startX: event.clientX, startMs: segment.startMs, endMs: segment.endMs }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const move = (event: React.PointerEvent): void => {
    const drag = dragRef.current
    if (!drag || props.pxPerSec <= 0) return
    const delta = (event.clientX - drag.startX) / props.pxPerSec * 1000
    const length = drag.endMs - drag.startMs
    if (drag.mode === 'move') {
      const startMs = Math.min(props.duration - length, Math.max(0, drag.startMs + delta))
      props.onRangeChange(drag.id, startMs, startMs + length, false)
    } else if (drag.mode === 'start') {
      props.onRangeChange(drag.id, Math.min(drag.endMs - 100, Math.max(0, drag.startMs + delta)), drag.endMs, false)
    } else {
      props.onRangeChange(drag.id, drag.startMs, Math.max(drag.startMs + 100, Math.min(props.duration, drag.endMs + delta)), false)
    }
  }

  const end = (event: React.PointerEvent): void => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag || props.pxPerSec <= 0) return
    const delta = (event.clientX - drag.startX) / props.pxPerSec * 1000
    const length = drag.endMs - drag.startMs
    if (drag.mode === 'move') {
      const startMs = Math.min(props.duration - length, Math.max(0, drag.startMs + delta))
      props.onRangeChange(drag.id, startMs, startMs + length, true)
    } else if (drag.mode === 'start') {
      props.onRangeChange(drag.id, Math.min(drag.endMs - 100, Math.max(0, drag.startMs + delta)), drag.endMs, true)
    } else {
      props.onRangeChange(drag.id, drag.startMs, Math.max(drag.startMs + 100, Math.min(props.duration, drag.endMs + delta)), true)
    }
  }

  return (
    <div className="relative h-[48px] border-t border-line">
      {props.segments.map((segment) => {
        const left = segment.startMs / props.duration * 100
        const width = Math.max(0.4, (segment.endMs - segment.startMs) / props.duration * 100)
        const selected = segment.id === props.selectedId
        return (
          <div key={segment.id} role="button" tabIndex={0} aria-label={`${segment.text}，${(segment.startMs / 1000).toFixed(1)} 秒`}
            className={cn('group absolute top-2 flex h-8 min-w-[8px] cursor-grab items-center overflow-hidden rounded-md border bg-accent-soft text-[9px] text-ink-2 outline-none', selected ? 'border-accent ring-1 ring-accent' : 'border-accent-border hover:border-accent')}
            style={{ left: `${left}%`, width: `${width}%` }}
            onPointerDown={(event) => begin(event, segment, 'move')} onPointerMove={move} onPointerUp={end}
            onContextMenu={(event) => props.onContextMenu(event, segment.startMs, segment.id)}
            onKeyDown={(event) => { if (event.key === 'Enter') { props.onSelect(segment.id); props.onSeek(segment.startMs) } }}>
            <button aria-label="调整字幕开始" className="h-full w-1.5 flex-none cursor-ew-resize bg-accent/35 opacity-0 group-hover:opacity-100"
              onPointerDown={(event) => begin(event, segment, 'start')} onPointerMove={move} onPointerUp={end} />
            <span className="min-w-0 flex-1 truncate px-1.5">{segment.text}</span>
            {overflowSet.has(segment.id) && (
              <span title="配音语速超出可调范围，可能溢出或被截断"
                className="flex-none pr-1 text-[10px] leading-none text-amber-400">⚠</span>
            )}
            <button aria-label="调整字幕结束" className="h-full w-1.5 flex-none cursor-ew-resize bg-accent/35 opacity-0 group-hover:opacity-100"
              onPointerDown={(event) => begin(event, segment, 'end')} onPointerMove={move} onPointerUp={end} />
          </div>
        )
      })}
    </div>
  )
})
