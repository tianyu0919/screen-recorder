import type { EditSaveState } from '@shared/edit'

export function EditSaveStatus({
  state,
  onRetry
}: {
  state: EditSaveState
  onRetry(): void
}): React.JSX.Element | null {
  if (state.kind === 'idle') return null
  if (state.kind === 'error') {
    return (
      <button
        title={state.message}
        onClick={onRetry}
        className="animate-in fade-in text-[11px] text-red-300 hover:text-red-200"
      >
        保存失败 · 点击重试
      </button>
    )
  }
  return (
    <span className="animate-in fade-in text-[11px] text-ink-3">
      {state.kind === 'saving' ? '保存中…' : '已保存'}
    </span>
  )
}
