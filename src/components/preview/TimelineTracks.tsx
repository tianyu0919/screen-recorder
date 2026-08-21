import { memo, useMemo } from 'react'
import type { MotionEffect } from '@shared/edit'
import type { RipplePoint } from '@/render/types'
import type { CustomClip } from '@/lib/audioClip'
import type { DisplayKeyPrompt } from '@/timeline/keyPrompts'
import {
  buildTimelineEventItems,
  clusterTimelineEvents,
  eventDensityBucket,
  type TimeWindow
} from '@/timeline/eventDisplay'
import { AudioClipsLayer } from './AudioClipsLayer'
import { MotionEffectsLayer } from './MotionEffectsLayer'
import type { TimelineMenuTarget } from './TimelineContextMenu'

interface TimelineTracksProps {
  motionEffects: MotionEffect[]
  selectedMotionId: string | null
  keyPrompts: DisplayKeyPrompt[]
  ripples: RipplePoint[]
  clips: CustomClip[]
  duration: number
  pxPerSec: number
  eventWindow: TimeWindow
  getPlayheadMs(): number
  onSelectMotion(id: string): void
  onSeek(tMs: number): void
  onMoveMotion(id: string, startMs: number, playheadMs: number): void
  onResizeMotion(id: string, edge: 'start' | 'end', tMs: number, playheadMs: number): void
  onCommitEdit(): void
  onOffsetChange(id: string, offsetMs: number): void
  onTrimChange(
    id: string,
    patch: Partial<Pick<CustomClip, 'offsetMs' | 'trimStartMs' | 'trimEndMs'>>
  ): void
  onContextMenu(event: React.MouseEvent, tMs: number, target?: TimelineMenuTarget): void
}

/** 静态时间轴轨道：运镜片段、密度自适应事件与自定义音频。 */
export const TimelineTracks = memo(function TimelineTracks(
  props: TimelineTracksProps
): React.JSX.Element {
  const density = eventDensityBucket(props.pxPerSec)
  const items = useMemo(
    () => buildTimelineEventItems(props.ripples, props.keyPrompts),
    [props.ripples, props.keyPrompts]
  )
  const clusters = useMemo(
    () => clusterTimelineEvents(items, Math.pow(Math.SQRT2, density), props.eventWindow),
    [items, density, props.eventWindow]
  )
  return (
    <>
      <div className="relative h-[42px] border-b border-line">
        <MotionEffectsLayer
          effects={props.motionEffects}
          duration={props.duration}
          pxPerSec={props.pxPerSec}
          selectedId={props.selectedMotionId}
          getPlayheadMs={props.getPlayheadMs}
          onSelect={props.onSelectMotion}
          onSeek={props.onSeek}
          onMove={props.onMoveMotion}
          onResize={props.onResizeMotion}
          onCommit={props.onCommitEdit}
          onContextMenu={props.onContextMenu}
        />
      </div>

      <div className="relative h-[42px]">
        {clusters.map((cluster) => {
          const single = cluster.items.length === 1 ? cluster.items[0] : null
          const title = cluster.items
            .map((item) => `${item.label} · ${(item.t / 1000).toFixed(1)}s`)
            .join('\n')
          return (
            <button
              key={cluster.id}
              title={title}
              className={
                cluster.mode === 'label'
                  ? 'absolute top-1/2 flex h-4 -translate-x-1/2 -translate-y-1/2 items-center rounded border border-line-strong bg-surface-3 px-1 font-mono text-[9px] text-ink-2'
                  : 'absolute top-1/2 h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#8e8e96]'
              }
              style={{ left: `${(cluster.t / props.duration) * 100}%` }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => props.onSeek(cluster.t)}
              onContextMenu={(event) =>
                props.onContextMenu(
                  event,
                  cluster.t,
                  single?.kind === 'key' ? { kind: 'key', id: single.id } : undefined
                )
              }
            >
              {cluster.mode === 'label' ? single?.label : null}
            </button>
          )
        })}
      </div>

      <div className="relative h-[48px] border-t border-line">
        <AudioClipsLayer
          clips={props.clips}
          duration={props.duration}
          pxPerSec={props.pxPerSec}
          onOffsetChange={props.onOffsetChange}
          onTrimChange={props.onTrimChange}
          onCommit={props.onCommitEdit}
          onContextMenu={props.onContextMenu}
        />
      </div>
    </>
  )
})
