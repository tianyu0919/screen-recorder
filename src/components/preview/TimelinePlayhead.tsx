import { useEffect, useLayoutEffect, useRef, type MutableRefObject, type RefObject } from 'react'

interface TimelinePlayheadProps {
  currentMs: number
  duration: number
  playing: boolean
  zoom: number
  scrollRef: RefObject<HTMLDivElement | null>
  followHoldUntil: MutableRefObject<number>
  subscribeCurrentMs(listener: (currentMs: number) => void): () => void
}

/** 播放头逐帧直接写 DOM；React 只负责低频时间文本。 */
export function TimelinePlayhead(props: TimelinePlayheadProps): React.JSX.Element {
  const { currentMs, duration, playing, zoom, scrollRef, followHoldUntil, subscribeCurrentMs } =
    props
  const playheadRef = useRef<HTMLDivElement>(null)

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
      className="pointer-events-none absolute bottom-0 top-0 w-[1.5px] bg-accent"
      style={{ left: `${Math.min(1, currentMs / duration) * 100}%` }}
    >
      <span className="absolute left-1/2 top-0 -translate-x-1/2 border-x-[5.5px] border-t-[7px] border-x-transparent border-t-accent" />
    </div>
  )
}
