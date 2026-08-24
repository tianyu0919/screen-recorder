import { useCallback, useLayoutEffect, useRef } from 'react'
import { useReducedMotion } from 'motion/react'

interface GridSnapshot {
  columns: number
  positions: Map<string, { left: number; top: number }>
}

/** 在响应式网格换列时用 FLIP 平滑移动卡片。 */
export function useGridFlip(itemKey: string): React.RefObject<HTMLDivElement> {
  const gridRef = useRef<HTMLDivElement>(null)
  const snapshotRef = useRef<GridSnapshot>({ columns: 0, positions: new Map() })
  const reduceMotion = useReducedMotion()

  const measure = useCallback((forceAnimation: boolean) => {
    const grid = gridRef.current
    if (!grid) return
    const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length
    const items = Array.from(grid.querySelectorAll<HTMLElement>('[data-grid-flip-item]'))
    const positions = new Map<string, { left: number; top: number }>()
    for (const item of items) {
      const id = item.dataset.gridFlipItem
      if (!id) continue
      const rect = item.getBoundingClientRect()
      positions.set(id, { left: rect.left, top: rect.top })
    }

    const previous = snapshotRef.current
    if (!reduceMotion && previous.columns > 0 && (forceAnimation || columns !== previous.columns)) {
      for (const item of items) {
        const id = item.dataset.gridFlipItem
        const before = id ? previous.positions.get(id) : undefined
        const after = id ? positions.get(id) : undefined
        if (!before || !after) continue
        const x = before.left - after.left
        const y = before.top - after.top
        if (Math.abs(x) < 1 && Math.abs(y) < 1) continue
        item.getAnimations().forEach((animation) => animation.cancel())
        item.animate(
          [{ transform: `translate(${x}px, ${y}px)` }, { transform: 'translate(0, 0)' }],
          { duration: 280, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
        )
      }
    }
    snapshotRef.current = { columns, positions }
  }, [reduceMotion])

  useLayoutEffect(() => measure(true), [itemKey, measure])
  useLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const observer = new ResizeObserver(() => measure(false))
    observer.observe(grid)
    measure(false)
    return () => observer.disconnect()
  }, [measure])

  return gridRef
}
