import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Play, Pause } from 'lucide'
import { MorphIcon } from 'morphicons/react'
import { usePreviewStore } from '@/store/previewStore'
import { effectiveDurationMs, sourceToOutputMs } from '@/timeline/cuts'
import { bufferedTimeWindow } from '@/timeline/eventDisplay'
import { CutsLayer, useCutRangeSelection } from './CutsLayer'
import { TimelineTracks } from './TimelineTracks'
import { TimelinePlayhead } from './TimelinePlayhead'
import { TimelineRuler } from './TimelineRuler'
import {
  TimelineContextMenu,
  type TimelineMenuState,
  type TimelineMenuTarget
} from './TimelineContextMenu'
import { KeyPromptCapture } from './KeyPromptCapture'
import { formatMs } from '@/timeline/ticks'

interface PlayerTimelineProps {
  playing: boolean
  currentMs: number
  durationMs: number
  onTogglePlay(): void
  onSeek(ms: number): void
  subscribeCurrentMs(listener: (currentMs: number) => void): () => void
}

/** 可缩放/平移的多轨时间轴；逐帧播放头与静态素材轨分离。 */
export function PlayerTimeline({
  playing,
  currentMs,
  durationMs,
  onTogglePlay,
  onSeek,
  subscribeCurrentMs
}: PlayerTimelineProps): React.JSX.Element {
  const store = usePreviewStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const currentMsRef = useRef(currentMs)
  currentMsRef.current = currentMs
  const getPlayheadMs = useCallback(() => currentMsRef.current, [])
  const [viewportW, setViewportW] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [scrollPage, setScrollPage] = useState(0)
  const [menu, setMenu] = useState<TimelineMenuState | null>(null)
  const [captureAt, setCaptureAt] = useState<number | null>(null)
  const pendingAnchor = useRef<{ ratio: number; cursorX: number } | null>(null)
  const followHoldUntil = useRef(0)
  const duration = Math.max(1, durationMs)
  const cutSel = useCutRangeSelection(contentRef, duration)
  const contentWpx = viewportW * zoom
  const pxPerSec = viewportW > 0 ? contentWpx / (duration / 1000) : 0
  const eventWindow = useMemo(
    () => bufferedTimeWindow(
      scrollPage * Math.max(1, viewportW / 2), viewportW, contentWpx, duration
    ),
    [scrollPage, viewportW, contentWpx, duration]
  )

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    const observer = new ResizeObserver(() => setViewportW(element.clientWidth))
    observer.observe(element)
    setViewportW(element.clientWidth)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    setZoom(1)
    setScrollPage(0)
  }, [durationMs])

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    let frame = 0
    const onScroll = (): void => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        setScrollPage(Math.floor(element.scrollLeft / Math.max(1, element.clientWidth / 2)))
      })
    }
    element.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      if (frame) cancelAnimationFrame(frame)
      element.removeEventListener('scroll', onScroll)
    }
  }, [])

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault()
      followHoldUntil.current = Date.now() + 1500
      if (!event.ctrlKey && Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        element.scrollLeft += event.deltaX
        return
      }
      const cursorX = event.clientX - element.getBoundingClientRect().left
      pendingAnchor.current = {
        ratio: (element.scrollLeft + cursorX) / Math.max(1, element.scrollWidth),
        cursorX
      }
      setZoom((value) => Math.min(12, Math.max(1, value * Math.exp(-event.deltaY * 0.002))))
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [])

  useLayoutEffect(() => {
    const element = scrollRef.current
    if (!element || !pendingAnchor.current) return
    element.scrollLeft =
      pendingAnchor.current.ratio * element.scrollWidth - pendingAnchor.current.cursorX
    pendingAnchor.current = null
  }, [zoom])

  const panRef = useRef<{ startX: number; startScroll: number; panned: boolean } | null>(null)
  const pointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0 || !scrollRef.current) return
    followHoldUntil.current = Date.now() + 1500
    panRef.current = {
      startX: event.clientX,
      startScroll: scrollRef.current.scrollLeft,
      panned: false
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const pointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    const state = panRef.current
    const element = scrollRef.current
    if (!state || !element) return
    const delta = event.clientX - state.startX
    if (Math.abs(delta) > 4) state.panned = true
    if (state.panned) element.scrollLeft = state.startScroll - delta
  }
  const pointerUp = (event: React.PointerEvent<HTMLDivElement>): void => {
    const state = panRef.current
    panRef.current = null
    if (!state || state.panned || durationMs === 0) return
    cutSel.setRangeSel(null)
    const rect = event.currentTarget.getBoundingClientRect()
    store.selectMotionEffect(null)
    onSeek(Math.round(Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)) * durationMs))
  }

  const openMenu = useCallback(
    (event: React.MouseEvent, tMs?: number, target?: TimelineMenuTarget): void => {
      event.preventDefault()
      event.stopPropagation()
      const rect = contentRef.current?.getBoundingClientRect()
      const time = tMs ?? (rect
        ? Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)) * duration
        : 0)
      setMenu({ x: event.clientX, y: event.clientY, tMs: time, target })
    },
    [duration]
  )

  const deleteTarget = (target: TimelineMenuTarget): void => {
    if (target.kind === 'motion') store.removeMotionEffect(target.id)
    else if (target.kind === 'key') store.removeKeyPrompt(target.id)
    else store.removeCustomClip(target.id)
  }

  return (
    <div className="flex h-[216px] select-none flex-none flex-col border-t border-line bg-surface-1">
      <div className="flex h-10 flex-none items-center gap-3 border-b border-line px-6">
        <button onClick={onTogglePlay} disabled={durationMs === 0} aria-label={playing ? '暂停' : '播放'} aria-pressed={playing} className="grid h-7 w-7 place-items-center rounded-full bg-ink-1 text-surface-1 transition-[transform,box-shadow] hover:scale-105 hover:shadow-card active:scale-95 disabled:opacity-40">
          <MorphIcon
            icon={playing ? Pause : Play}
            size={13}
            strokeWidth={2.4}
            spring="snappy"
            reducedMotion="user"
          />
        </button>
        <span className="font-mono text-[12.5px] text-ink-1">
          {formatMs(sourceToOutputMs(currentMs, store.cuts))}{' '}
          <span className="text-ink-3">/ {formatMs(effectiveDurationMs(durationMs, store.cuts))}</span>
        </span>
        <span className="flex-1" />
        {zoom > 1 && <button onClick={() => setZoom(1)} className="rounded-md border border-line bg-surface-2 px-2 py-0.5 font-mono text-[10.5px] text-ink-2">{Math.round(zoom * 100)}%</button>}
        <span className="text-[10.5px] text-ink-3">左键定位 · 右键添加 · 滚轮缩放 · 拖动平移</span>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex w-[62px] flex-none flex-col border-r border-line pt-[22px] text-[10.5px] text-ink-3">
          <span className="flex h-[42px] items-center justify-center border-b border-line">运镜</span>
          <span className="flex h-[42px] items-center justify-center">事件</span>
          <span className="flex h-[48px] items-center justify-center border-t border-line">音频</span>
        </div>
        <div ref={scrollRef} className="no-scrollbar min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
          <div
            ref={contentRef}
            className="relative h-full"
            style={{ width: viewportW > 0 ? `${Math.round(contentWpx)}px` : '100%' }}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
            onContextMenu={(event) => openMenu(event)}
          >
            <TimelineRuler duration={duration} contentWidth={contentWpx} pxPerSec={pxPerSec} onPointerDown={cutSel.beginDrag('create')} onPointerMove={cutSel.onDragMove} onPointerUp={cutSel.onDragEnd} />
            <CutsLayer cuts={store.cuts} duration={duration} rangeSel={cutSel.rangeSel} sel={cutSel} onCommit={() => { if (cutSel.rangeSel) store.addCut(cutSel.rangeSel); cutSel.setRangeSel(null) }} onDiscard={() => cutSel.setRangeSel(null)} onEditCut={(range, index) => { store.removeCut(index); cutSel.setRangeSel(range) }} />
            <TimelineTracks
              motionEffects={store.motionEffects} motionEnabled={store.motionEnabled}
              selectedMotionId={store.selectedMotionId}
              keyPrompts={store.keyPrompts} ripples={store.ripples} clips={store.customClips}
              duration={duration} pxPerSec={pxPerSec} eventWindow={eventWindow} getPlayheadMs={getPlayheadMs}
              onSelectMotion={store.selectMotionEffect} onSeek={onSeek}
              onMoveMotion={(id, start, anchor) => store.moveMotionEffect(id, start, false, anchor)}
              onResizeMotion={(id, edge, time, anchor) => store.resizeMotionEffect(id, edge, time, false, anchor)}
              onCommitEdit={store.commitEdit} onOffsetChange={store.setClipOffset}
              onTrimChange={store.setClipTrim} onContextMenu={openMenu}
            />
            <TimelinePlayhead currentMs={currentMs} duration={duration} playing={playing} zoom={zoom} scrollRef={scrollRef} followHoldUntil={followHoldUntil} subscribeCurrentMs={subscribeCurrentMs} />
          </div>
        </div>
      </div>

      <TimelineContextMenu menu={menu} onClose={() => setMenu(null)} onAddMotion={(time) => { store.addMotionEffect(time) }} onAddKey={setCaptureAt} onAddAudio={(time) => { void store.addCustomClip(time) }} onDelete={deleteTarget} />
      <KeyPromptCapture open={captureAt !== null} onCancel={() => setCaptureAt(null)} onConfirm={(keys) => { if (captureAt !== null) store.addManualKeyPrompt(captureAt, keys); setCaptureAt(null) }} />
    </div>
  )
}
