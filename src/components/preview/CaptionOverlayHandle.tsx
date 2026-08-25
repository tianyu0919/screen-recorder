import { useRef, type PointerEvent } from 'react'
import { Captions } from 'lucide-react'

interface Props {
  position: { x: number; y: number }
  segmentOnly: boolean
  onChange(position: { x: number; y: number }, segmentOnly: boolean, commit?: boolean): void
}

export function CaptionOverlayHandle({ position, segmentOnly, onChange }: Props): React.JSX.Element {
  const dragging = useRef(false)
  const update = (event: PointerEvent<HTMLButtonElement>, commit = false): void => {
    const rect = event.currentTarget.parentElement?.getBoundingClientRect()
    if (!rect) return
    onChange({
      x: (event.clientX - rect.left) / Math.max(1, rect.width),
      y: (event.clientY - rect.top) / Math.max(1, rect.height)
    }, segmentOnly, commit)
  }
  return (
    <button type="button" aria-label={segmentOnly ? '拖动当前字幕位置' : '拖动全局字幕位置'}
      className="absolute z-10 flex h-7 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center gap-1.5 rounded-full border border-accent-border bg-surface-1/90 px-2.5 text-[10px] font-medium text-accent shadow-card backdrop-blur-sm active:cursor-grabbing"
      style={{ left: `${position.x * 100}%`, top: `${position.y * 100}%` }}
      onPointerDown={(event) => { event.stopPropagation(); dragging.current = true; event.currentTarget.setPointerCapture(event.pointerId); update(event) }}
      onPointerMove={(event) => { if (dragging.current) update(event) }}
      onPointerUp={(event) => { if (!dragging.current) return; update(event, true); dragging.current = false; event.currentTarget.releasePointerCapture(event.pointerId) }}
      onPointerCancel={(event) => { if (dragging.current) update(event, true); dragging.current = false }}
      onClick={(event) => event.stopPropagation()}>
      <Captions size={12} />{segmentOnly ? '当前字幕' : '字幕位置'}
    </button>
  )
}
