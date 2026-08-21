import { useRef, type PointerEvent } from 'react'

interface KeyboardOverlayHandleProps {
  position: { x: number; y: number }
  onChange(position: { x: number; y: number }, commit?: boolean): void
}

/** 仅编辑器可见的全局位置手柄；实际提示由 WebGL 合成层绘制。 */
export function KeyboardOverlayHandle({
  position,
  onChange
}: KeyboardOverlayHandleProps): React.JSX.Element {
  const draggingRef = useRef<{ offsetX: number; offsetY: number } | null>(null)

  const update = (event: PointerEvent<HTMLButtonElement>, commit = false): void => {
    const container = event.currentTarget.parentElement
    if (!container) return
    const rect = container.getBoundingClientRect()
    const drag = draggingRef.current ?? { offsetX: 0, offsetY: 0 }
    onChange(
      {
        x: (event.clientX - drag.offsetX - rect.left) / Math.max(1, rect.width),
        y: (event.clientY - drag.offsetY - rect.top) / Math.max(1, rect.height)
      },
      commit
    )
  }

  return (
    <button
      type="button"
      aria-label="拖动按键提示位置"
      title="拖动设置所有按键提示的位置"
      className="absolute z-10 cursor-grab select-none rounded-md border border-accent-border bg-black/55 px-2 py-1 text-[10px] font-medium text-white/85 shadow-lg backdrop-blur-sm hover:bg-black/75 active:cursor-grabbing"
      style={{
        left: `${position.x * 100}%`,
        top: `${position.y * 100}%`,
        transform:
          position.y > 0.18
            ? 'translate(-50%, calc(-50% - 46px))'
            : 'translate(-50%, calc(-50% + 46px))'
      }}
      onPointerDown={(event) => {
        event.stopPropagation()
        const rect = event.currentTarget.parentElement?.getBoundingClientRect()
        if (!rect) return
        draggingRef.current = {
          offsetX: event.clientX - (rect.left + position.x * rect.width),
          offsetY: event.clientY - (rect.top + position.y * rect.height)
        }
        event.currentTarget.setPointerCapture(event.pointerId)
        update(event)
      }}
      onPointerMove={(event) => {
        if (draggingRef.current) update(event)
      }}
      onPointerUp={(event) => {
        if (!draggingRef.current) return
        update(event, true)
        draggingRef.current = null
        event.currentTarget.releasePointerCapture(event.pointerId)
      }}
      onPointerCancel={(event) => {
        if (!draggingRef.current) return
        update(event, true)
        draggingRef.current = null
      }}
      onClick={(event) => event.stopPropagation()}
    >
      ⌨ 按键提示
    </button>
  )
}
