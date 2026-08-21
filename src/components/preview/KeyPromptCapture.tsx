import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { isAllowedKeyPrompt, normalizeKeyName } from '@/timeline/keyPrompts'

interface Props {
  open: boolean
  onCancel(): void
  onConfirm(keys: string[]): void
}

function keysFromEvent(event: KeyboardEvent): string[] {
  const keys: string[] = []
  if (event.ctrlKey) keys.push('CTRL')
  if (event.altKey) keys.push('ALT')
  if (event.shiftKey) keys.push('SHIFT')
  if (event.metaKey) keys.push('META')
  const key = normalizeKeyName(event.key)
  if (!['CTRL', 'ALT', 'SHIFT', 'META'].includes(key)) keys.push(key)
  return [...new Set(keys)]
}

export function KeyPromptCapture({ open, onCancel, onConfirm }: Props): React.JSX.Element | null {
  const [preview, setPreview] = useState<string[]>([])
  useEffect(() => {
    if (!open) return
    setPreview([])
    const down = (event: KeyboardEvent): void => {
      event.preventDefault()
      event.stopPropagation()
      const keys = keysFromEvent(event)
      setPreview(keys)
      if (isAllowedKeyPrompt(keys) && !['CTRL', 'ALT', 'SHIFT', 'META'].includes(normalizeKeyName(event.key))) {
        onConfirm(keys)
      }
    }
    const up = (event: KeyboardEvent): void => {
      const key = normalizeKeyName(event.key)
      if (['CTRL', 'ALT', 'SHIFT', 'META'].includes(key) && preview.length === 1) {
        onConfirm([key])
      }
    }
    window.addEventListener('keydown', down, true)
    window.addEventListener('keyup', up, true)
    return () => {
      window.removeEventListener('keydown', down, true)
      window.removeEventListener('keyup', up, true)
    }
  }, [open, onConfirm, preview.length])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[110] grid place-items-center bg-black/35" onPointerDown={onCancel}>
      <div
        className="w-[300px] rounded-xl border border-line-strong bg-surface-1 p-4 shadow-2xl"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <h3 className="text-[13px] font-medium text-ink-1">添加键盘提示</h3>
        <p className="mt-1 text-[11px] text-ink-3">请按快捷键、功能键或单独修饰键</p>
        <div className="mt-4 flex min-h-10 items-center justify-center rounded-lg border border-line bg-surface-2 font-mono text-sm text-accent">
          {preview.length > 0 ? preview.join(' + ') : '等待按键…'}
        </div>
        <button className="mt-3 w-full text-[11px] text-ink-3 hover:text-ink-1" onClick={onCancel}>
          取消
        </button>
      </div>
    </div>,
    document.body
  )
}
