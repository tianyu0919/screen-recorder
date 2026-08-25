import { useEffect, useRef, useState } from 'react'
import { LoaderCircle, Pencil } from 'lucide-react'
import { validateSessionDisplayName } from '@shared/sessionName'

interface EditableSessionNameProps {
  sessionId: string
  displayName?: string
  onRename(displayName: string): Promise<string>
}

export function EditableSessionName({
  sessionId,
  displayName,
  onRename
}: EditableSessionNameProps): React.JSX.Element {
  const shownName = displayName ?? sessionId
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(shownName)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const committingRef = useRef(false)

  useEffect(() => {
    if (!editing) setValue(shownName)
  }, [editing, shownName])

  useEffect(() => {
    if (!editing) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [editing])

  const beginEditing = (): void => {
    setValue(shownName)
    setError(null)
    setEditing(true)
  }

  const commit = async (): Promise<void> => {
    if (committingRef.current) return
    const validationError = validateSessionDisplayName(value)
    if (validationError) {
      setError(validationError)
      requestAnimationFrame(() => inputRef.current?.focus())
      return
    }
    if (value.trim() === shownName) {
      setEditing(false)
      return
    }
    committingRef.current = true
    setSaving(true)
    setError(null)
    try {
      const saved = await onRename(value)
      setValue(saved)
      setEditing(false)
    } catch (cause) {
      setError(readRenameError(cause))
      requestAnimationFrame(() => inputRef.current?.focus())
    } finally {
      committingRef.current = false
      setSaving(false)
    }
  }

  if (!editing) {
    return <button type="button" title="双击重命名（键盘按 Enter 或 F2）"
      aria-label={`录像名称：${shownName}，双击重命名`}
      onDoubleClick={beginEditing}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === 'F2') {
          event.preventDefault()
          beginEditing()
        }
      }}
      className="group/name flex min-w-0 max-w-[240px] items-center gap-1 rounded-md px-1 py-0.5 text-[11px] text-ink-3 outline-none transition-colors hover:bg-surface-2 hover:text-ink-1 focus-visible:ring-2 focus-visible:ring-accent">
      <span className={`truncate ${displayName ? 'font-medium' : 'font-mono'}`}>{shownName}</span>
      <Pencil size={10} aria-hidden="true" className="flex-none opacity-0 transition-opacity group-hover/name:opacity-70 group-focus-visible/name:opacity-70" />
    </button>
  }

  return <span className="relative block min-w-0">
    <input ref={inputRef} value={value} disabled={saving} aria-label="录像名称"
      aria-invalid={error !== null} aria-describedby={error ? 'session-name-error' : undefined}
      onChange={(event) => { setValue(event.target.value); setError(null) }}
      onBlur={() => void commit()}
      onKeyDown={(event) => {
        if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() }
        if (event.key === 'Escape') {
          event.preventDefault()
          setValue(shownName)
          setError(null)
          setEditing(false)
        }
      }}
      className={`h-7 w-[min(240px,24vw)] min-w-[140px] rounded-md border bg-surface-1 px-2 pr-7 text-[11px] text-ink-1 outline-none focus:ring-2 focus:ring-accent ${error ? 'border-danger' : 'border-line-strong'}`} />
    {saving && <LoaderCircle size={12} aria-hidden="true" className="absolute right-2 top-2 animate-spin text-accent" />}
    {error && <span id="session-name-error" role="alert"
      className="absolute left-0 top-[calc(100%+4px)] z-30 w-max max-w-[260px] rounded-lg border border-danger/20 bg-surface-1 px-2 py-1 text-[10px] text-danger shadow-float">
      {error}
    </span>}
  </span>
}

function readRenameError(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : String(cause)
  return message.replace(/^Error invoking remote method '[^']+': Error: /, '') || '录像名称保存失败，请重试'
}
