import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { formatMs } from '@/timeline/ticks'
import { Trash2 } from 'lucide-react'

export type TimelineMenuTarget =
  | { kind: 'motion'; id: string }
  | { kind: 'key'; id: string }
  | { kind: 'audio'; id: string }

export interface TimelineMenuState {
  x: number
  y: number
  tMs: number
  target?: TimelineMenuTarget
}

interface Props {
  menu: TimelineMenuState | null
  onClose(): void
  onAddMotion(tMs: number): void
  onAddKey(tMs: number): void
  onAddAudio(tMs: number): void
  onDelete(target: TimelineMenuTarget): void
}

export function TimelineContextMenu({
  menu,
  onClose,
  onAddMotion,
  onAddKey,
  onAddAudio,
  onDelete
}: Props): React.JSX.Element | null {
  useEffect(() => {
    if (!menu) return
    const close = (): void => onClose()
    const key = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', close)
    window.addEventListener('blur', close)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('blur', close)
      window.removeEventListener('keydown', key)
    }
  }, [menu, onClose])

  if (!menu) return null
  const left = Math.min(menu.x, window.innerWidth - 190)
  const top = Math.min(menu.y, window.innerHeight - 220)
  const run = (action: () => void): void => {
    action()
    onClose()
  }
  return createPortal(
    <div
      data-timeline-menu
      className="fixed z-[100] w-[178px] overflow-hidden rounded-lg border border-line-strong bg-surface-2 p-1 shadow-2xl"
      style={{ left, top }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="px-2 py-1 font-mono text-[9.5px] text-ink-3">{formatMs(menu.tMs)}</div>
      {menu.target && (
        <>
          <button
            className="flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-[11px] font-medium text-danger transition-[color,background-color,border-color] [background:color-mix(in_srgb,var(--danger)_8%,transparent)] hover:border-danger hover:[background:color-mix(in_srgb,var(--danger)_15%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
            onClick={() => run(() => onDelete(menu.target!))}
          >
            <Trash2 size={12} strokeWidth={2} />
            删除{menu.target.kind === 'motion' ? '运镜' : menu.target.kind === 'key' ? '事件' : '音频'}
          </button>
          <div className="my-1 border-t border-line" />
        </>
      )}
      <MenuButton label="添加运镜" onClick={() => run(() => onAddMotion(menu.tMs))} />
      <MenuButton label="添加事件" onClick={() => run(() => onAddKey(menu.tMs))} />
      <MenuButton label="添加音频" onClick={() => run(() => onAddAudio(menu.tMs))} />
    </div>,
    document.body
  )
}

function MenuButton({ label, onClick }: { label: string; onClick(): void }): React.JSX.Element {
  return (
    <button
      className="w-full rounded-md px-2 py-1.5 text-left text-[11px] text-ink-1 hover:bg-surface-3"
      onClick={onClick}
    >
      {label}
    </button>
  )
}
