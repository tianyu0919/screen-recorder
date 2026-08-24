import { memo, useRef } from 'react'
import type { MotionEffect } from '@shared/edit'
import { cn } from '@/lib/utils'
import { formatMs } from '@/timeline/ticks'
import type { TimelineMenuTarget } from './TimelineContextMenu'

interface Props {
  effects: MotionEffect[]
  enabled: boolean
  duration: number
  pxPerSec: number
  selectedId: string | null
  getPlayheadMs(): number
  onSelect(id: string): void
  onSeek(tMs: number): void
  onMove(id: string, startMs: number, playheadMs: number): void
  onResize(id: string, edge: 'start' | 'end', tMs: number, playheadMs: number): void
  onCommit(): void
  onContextMenu(event: React.MouseEvent, tMs: number, target: TimelineMenuTarget): void
}

type DragMode = 'move' | 'start' | 'end'

function MotionBlock({ effect, props }: { effect: MotionEffect; props: Props }): React.JSX.Element {
  const drag = useRef<{
    mode: DragMode
    startX: number
    startMs: number
    endMs: number
    moved: boolean
  } | null>(null)
  const widthPx = ((effect.endMs - effect.startMs) / 1000) * props.pxPerSec
  const selected = effect.id === props.selectedId

  const begin = (mode: DragMode) => (event: React.PointerEvent<HTMLElement>): void => {
    if (event.button !== 0 || !props.enabled) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      mode,
      startX: event.clientX,
      startMs: effect.startMs,
      endMs: effect.endMs,
      moved: false
    }
    props.onSelect(effect.id)
    if (mode === 'move') props.onSeek(effect.startMs)
  }

  const move = (event: React.PointerEvent<HTMLElement>): void => {
    const state = drag.current
    if (!state || props.pxPerSec <= 0) return
    const deltaMs = ((event.clientX - state.startX) / props.pxPerSec) * 1000
    if (Math.abs(deltaMs) > 2) state.moved = true
    if (state.mode === 'move') {
      props.onMove(effect.id, state.startMs + deltaMs, props.getPlayheadMs())
    } else if (state.mode === 'start') {
      props.onResize(effect.id, 'start', state.startMs + deltaMs, props.getPlayheadMs())
    } else {
      props.onResize(effect.id, 'end', state.endMs + deltaMs, props.getPlayheadMs())
    }
  }

  const end = (event: React.PointerEvent<HTMLElement>): void => {
    const state = drag.current
    drag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (state?.moved) props.onCommit()
  }

  const detail = props.enabled
    ? `${effect.zoom.toFixed(1)}x · ${formatMs(effect.startMs)}–${formatMs(effect.endMs)} · ${((effect.endMs - effect.startMs) / 1000).toFixed(1)}s`
    : '运镜已关闭，启用后可继续编辑'
  return (
    <div
      title={detail}
      className={cn(
        'group absolute top-[9px] flex h-6 items-center justify-center overflow-hidden rounded-md border font-mono text-[10.5px]',
        !props.enabled
          ? 'cursor-not-allowed border-line-strong bg-surface-3 text-ink-3 opacity-45'
          : selected
          ? 'border-accent bg-[rgba(255,92,56,0.24)] text-accent shadow-[0_0_0_2px_rgba(255,92,56,0.18)]'
          : 'cursor-grab border-[rgba(255,92,56,0.3)] bg-accent-soft text-accent/80 hover:border-accent-border active:cursor-grabbing'
      )}
      style={{
        left: `${(effect.startMs / props.duration) * 100}%`,
        width: `${((effect.endMs - effect.startMs) / props.duration) * 100}%`
      }}
      onPointerDown={begin('move')}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onContextMenu={(event) => {
        if (props.enabled) props.onContextMenu(event, effect.startMs, { kind: 'motion', id: effect.id })
        else event.preventDefault()
      }}
    >
      {(widthPx > 44 || selected) && <span className="pointer-events-none">{effect.zoom.toFixed(1)}x</span>}
      {props.enabled && <span
        aria-label="调整运镜开始时间"
        className="absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize border-l-2 border-accent opacity-40 group-hover:opacity-100"
        onPointerDown={begin('start')}
      />}
      {props.enabled && <span
        aria-label="调整运镜结束时间"
        className="absolute inset-y-0 right-0 z-10 w-2 cursor-ew-resize border-r-2 border-accent opacity-40 group-hover:opacity-100"
        onPointerDown={begin('end')}
      />}
    </div>
  )
}

export const MotionEffectsLayer = memo(function MotionEffectsLayer(props: Props): React.JSX.Element {
  return (
    <>
      {props.effects.map((effect) => (
        <MotionBlock key={effect.id} effect={effect} props={props} />
      ))}
    </>
  )
})
