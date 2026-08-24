import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import type { CutRange } from '@/timeline/cuts'
import { CheckIcon, CloseIcon } from '@/components/icons'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type DragMode = 'create' | 'move' | 'resize-l' | 'resize-r'
type DragHandler = (e: React.PointerEvent<HTMLElement>) => void

interface RangeSelection {
  rangeSel: CutRange | null
  setRangeSel(sel: CutRange | null): void
  beginDrag(mode: DragMode): DragHandler
  onDragMove: DragHandler
  onDragEnd: DragHandler
}

/**
 * 刻度尺框选/选区调整的拖拽状态机：
 * create = 刻度尺拖出新选区；move = 按住选区整体移动；resize-l/r = 拖左右边改范围。
 * 位置换算以时间轴内容区宽度为基准（contentRef），暂停态同样可用。
 */
export function useCutRangeSelection(
  contentRef: RefObject<HTMLDivElement | null>,
  duration: number
): RangeSelection {
  const [rangeSel, setRangeSel] = useState<CutRange | null>(null)
  const drag = useRef<{
    mode: DragMode
    startClientX: number
    orig: CutRange
    rectW: number
  } | null>(null)

  const msFromClientX = (clientX: number): number => {
    const el = contentRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    const r = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    return r * duration
  }

  const beginDrag =
    (mode: DragMode): DragHandler =>
    (e) => {
      e.stopPropagation()
      const rectW = contentRef.current?.getBoundingClientRect().width ?? 1
      const ms = msFromClientX(e.clientX)
      drag.current = {
        mode,
        startClientX: e.clientX,
        orig: mode === 'create' ? { startMs: ms, endMs: ms } : (rangeSel ?? { startMs: ms, endMs: ms }),
        rectW
      }
      if (mode === 'create') setRangeSel({ startMs: ms, endMs: ms })
      e.currentTarget.setPointerCapture(e.pointerId)
    }

  const onDragMove: DragHandler = (e) => {
    const d = drag.current
    if (!d) return
    const dMs = ((e.clientX - d.startClientX) / d.rectW) * duration
    if (d.mode === 'create') {
      const b = msFromClientX(e.clientX)
      setRangeSel({
        startMs: Math.min(d.orig.startMs, b),
        endMs: Math.max(d.orig.startMs, b)
      })
    } else if (d.mode === 'move') {
      const len = d.orig.endMs - d.orig.startMs
      const s = Math.min(Math.max(0, d.orig.startMs + dMs), duration - len)
      setRangeSel({ startMs: s, endMs: s + len })
    } else if (d.mode === 'resize-l') {
      const s = Math.min(Math.max(0, d.orig.startMs + dMs), d.orig.endMs - 100)
      setRangeSel({ startMs: s, endMs: d.orig.endMs })
    } else {
      const end = Math.max(Math.min(duration, d.orig.endMs + dMs), d.orig.startMs + 100)
      setRangeSel({ startMs: d.orig.startMs, endMs: end })
    }
  }

  const onDragEnd: DragHandler = () => {
    const d = drag.current
    drag.current = null
    // 过短的框选视为误触；move/resize 的结果保留待确认
    if (d?.mode === 'create') {
      setRangeSel((sel) => (sel && sel.endMs - sel.startMs >= 100 ? sel : null))
    }
  }

  return { rangeSel, setRangeSel, beginDrag, onDragMove, onDragEnd }
}

interface CutsLayerProps {
  cuts: CutRange[]
  duration: number
  scrollRef: RefObject<HTMLDivElement | null>
  rangeSel: CutRange | null
  sel: RangeSelection
  onCommit(): void
  onDiscard(): void
  /** 单击已裁区间的「编辑此段」：撤出 cuts 并退回为可编辑选区（由调用方实现） */
  onEditCut(range: CutRange, index: number): void
}

/** 裁剪交互层：待确认选区（拖边/移动/确认/放弃）+ 已裁区间遮罩（单击弹「编辑此段」气泡） */
export function CutsLayer({
  cuts,
  duration,
  scrollRef,
  rangeSel,
  sel,
  onCommit,
  onDiscard,
  onEditCut
}: CutsLayerProps): React.JSX.Element {
  const [activeCut, setActiveCut] = useState<number | null>(null)
  const selectionActionsRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const viewport = scrollRef.current
    const actions = selectionActionsRef.current
    if (!viewport || !actions || !rangeSel) return
    let frame = 0
    const position = (): void => {
      frame = 0
      const halfWidth = actions.offsetWidth / 2
      const viewportCenter = viewport.scrollLeft + viewport.clientWidth / 2
      const preferred = ((rangeSel.startMs + rangeSel.endMs) / 2 / duration) * viewport.scrollWidth
      const inset = 8
      const min = viewport.scrollLeft + halfWidth + inset
      const max = viewport.scrollLeft + viewport.clientWidth - halfWidth - inset
      const left = min <= max ? Math.min(max, Math.max(min, preferred)) : viewportCenter
      actions.style.left = `${left}px`
    }
    const schedulePosition = (): void => {
      if (!frame) frame = requestAnimationFrame(position)
    }
    const observer = new ResizeObserver(schedulePosition)
    position()
    observer.observe(viewport)
    observer.observe(actions)
    viewport.addEventListener('scroll', schedulePosition, { passive: true })
    return () => {
      if (frame) cancelAnimationFrame(frame)
      observer.disconnect()
      viewport.removeEventListener('scroll', schedulePosition)
    }
  }, [duration, rangeSel, scrollRef])

  // 点击气泡以外区域收起「编辑此段」
  useEffect(() => {
    if (activeCut === null) return
    const onDocDown = (e: PointerEvent): void => {
      if (!(e.target as HTMLElement).closest('[data-cut-popover]')) setActiveCut(null)
    }
    document.addEventListener('pointerdown', onDocDown)
    return () => document.removeEventListener('pointerdown', onDocDown)
  }, [activeCut])

  const pct = (ms: number): string => `${(ms / duration) * 100}%`

  return (
    <>
      {cuts.map((c, i) => (
        <div key={`${c.startMs}-${c.endMs}`}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                aria-label="已裁掉 · 点击编辑"
                onPointerDown={(e) => {
                  e.stopPropagation()
                  setActiveCut(i)
                }}
                className="absolute bottom-0 top-0 z-10 border-x border-[rgba(255,92,56,0.35)]"
                style={{
                  left: pct(c.startMs),
                  width: pct(c.endMs - c.startMs),
                  background:
                    'repeating-linear-gradient(45deg, rgba(255,92,56,0.16) 0 6px, rgba(255,92,56,0.05) 6px 12px)'
                }}
              />
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={8} collisionPadding={12}>
              已裁掉 · 点击编辑
            </TooltipContent>
          </Tooltip>
          {activeCut === i && (
            <div
              data-cut-popover
              className="absolute bottom-[5px] z-20 -translate-x-1/2"
              style={{ left: pct((c.startMs + c.endMs) / 2) }}
              // 阻止冒泡：内容区平移手势的 pointer capture 会吞掉按钮的 click
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  onEditCut(c, i)
                  setActiveCut(null)
                }}
                className="whitespace-nowrap rounded-md border border-line bg-surface-2 px-2.5 py-1 text-[11.5px] font-medium text-ink-1 shadow-lg hover:bg-surface-3"
              >
                编辑此段
              </button>
            </div>
          )}
        </div>
      ))}

      {rangeSel && rangeSel.endMs > rangeSel.startMs && <>
        <div
          className="absolute bottom-0 top-0 z-[15] border-x border-accent bg-accent-soft"
          style={{ left: pct(rangeSel.startMs), width: pct(rangeSel.endMs - rangeSel.startMs) }}
        >
          {/* 主体：按住移动整个选区 */}
          <div
            className="absolute inset-0 cursor-move"
            onPointerDown={sel.beginDrag('move')}
            onPointerMove={sel.onDragMove}
            onPointerUp={sel.onDragEnd}
          />
          {/* 左右边缘：拖动调整范围 */}
          <div
            className="absolute bottom-0 left-[-4px] top-0 w-[8px] cursor-ew-resize"
            onPointerDown={sel.beginDrag('resize-l')}
            onPointerMove={sel.onDragMove}
            onPointerUp={sel.onDragEnd}
          />
          <div
            className="absolute bottom-0 right-[-4px] top-0 w-[8px] cursor-ew-resize"
            onPointerDown={sel.beginDrag('resize-r')}
            onPointerMove={sel.onDragMove}
            onPointerUp={sel.onDragEnd}
          />
        </div>
        {/* 确认 / 放弃：相对当前可视区碰撞避让，不随窄选区被裁切。 */}
        <div
          ref={selectionActionsRef}
          className="absolute bottom-[5px] z-20 flex -translate-x-1/2 gap-1.5 whitespace-nowrap"
          style={{ left: pct((rangeSel.startMs + rangeSel.endMs) / 2) }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={onCommit}
            className="flex h-7 items-center gap-1 rounded-md bg-accent px-2.5 text-[11.5px] font-semibold text-on-accent shadow-lg hover:bg-accent-hover"
          >
            <CheckIcon size={11} />
            裁掉这段
          </button>
          <button
            onClick={onDiscard}
            aria-label="取消裁剪选区"
            title="取消"
            className="grid h-7 w-7 place-items-center rounded-md border border-line bg-surface-2 text-ink-2 shadow-lg hover:bg-surface-3 hover:text-ink-1"
          >
            <CloseIcon size={11} />
          </button>
        </div>
      </>}
    </>
  )
}
