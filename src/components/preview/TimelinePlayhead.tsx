import { useEffect, useLayoutEffect, useRef, type MutableRefObject, type RefObject } from 'react'
import type { CutRange } from '@/timeline/cuts'
import { snapDraggedTimeToCuts } from '@/timeline/cuts'

interface TimelinePlayheadProps {
  currentMs: number
  duration: number
  playing: boolean
  zoom: number
  cuts: CutRange[]
  scrollRef: RefObject<HTMLDivElement | null>
  followHoldUntil: MutableRefObject<number>
  subscribeCurrentMs(listener: (currentMs: number) => void): () => void
  onSeek(ms: number): void
  onTogglePlay(): void
}

/** 播放头逐帧直接写 DOM；React 只负责低频时间文本。 */
export function TimelinePlayhead(props: TimelinePlayheadProps): React.JSX.Element {
  const {
    currentMs, duration, playing, zoom, cuts, scrollRef, followHoldUntil,
    subscribeCurrentMs, onSeek, onTogglePlay
  } = props
  const playheadRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pointerId: number; resume: boolean } | null>(null)

  const seekFromPointer = (clientX: number): void => {
    const content = playheadRef.current?.parentElement
    if (!content) return
    const rect = content.getBoundingClientRect()
    const rawMs = ((clientX - rect.left) / Math.max(1, rect.width)) * duration
    onSeek(snapDraggedTimeToCuts(rawMs, duration, cuts))
  }

  const endDrag = (event: React.PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    seekFromPointer(event.clientX)
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (drag.resume) onTogglePlay()
  }

  useEffect(() => {
    const scroll = scrollRef.current
    return subscribeCurrentMs((nextMs) => {
      if (playheadRef.current) {
        playheadRef.current.style.left = `${Math.min(1, nextMs / duration) * 100}%`
      }
      if (!scroll || !playing || zoom <= 1 || Date.now() < followHoldUntil.current) return
      const x = (nextMs / duration) * scroll.scrollWidth
      const viewportWidth = scroll.clientWidth
      const low = scroll.scrollLeft + viewportWidth * 0.15
      const high = scroll.scrollLeft + viewportWidth * 0.85
      const delta = x < low ? x - low : x > high ? x - high : 0
      if (delta !== 0) scroll.scrollLeft = Math.max(0, scroll.scrollLeft + delta * 0.18)
    })
  }, [duration, followHoldUntil, playing, scrollRef, subscribeCurrentMs, zoom])

  useLayoutEffect(() => {
    if (playheadRef.current) {
      playheadRef.current.style.left = `${Math.min(1, currentMs / duration) * 100}%`
    }
  }, [currentMs, duration])

  return (
    <div
      ref={playheadRef}
      role="slider"
      tabIndex={0}
      aria-label="播放位置"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(currentMs)}
      className="absolute bottom-0 top-0 z-30 w-4 -translate-x-1/2 cursor-ew-resize touch-none"
      style={{ left: `${Math.min(1, currentMs / duration) * 100}%` }}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        event.stopPropagation()
        followHoldUntil.current = Date.now() + 1500
        dragRef.current = { pointerId: event.pointerId, resume: playing }
        event.currentTarget.setPointerCapture(event.pointerId)
        if (playing) onTogglePlay()
        seekFromPointer(event.clientX)
      }}
      onPointerMove={(event) => {
        if (dragRef.current?.pointerId !== event.pointerId) return
        event.preventDefault()
        event.stopPropagation()
        seekFromPointer(event.clientX)
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <span className="pointer-events-none absolute bottom-0 left-1/2 top-0 w-[1.5px] -translate-x-1/2 bg-accent" />
      <span className="absolute left-1/2 top-0 -translate-x-1/2 border-x-[5.5px] border-t-[7px] border-x-transparent border-t-accent" />
    </div>
  )
}
