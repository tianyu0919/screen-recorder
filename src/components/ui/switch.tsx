import { cn } from '@/lib/utils'

interface SwitchProps {
  checked: boolean
  onChange(checked: boolean): void
  disabled?: boolean
  label?: string
}

/** 设计稿开关：36x21 全圆角，开启态为强调橙 */
export function Switch({ checked, onChange, disabled, label }: SwitchProps): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-state={checked ? 'checked' : 'unchecked'}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'ui-switch relative h-[22px] w-[38px] flex-none rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base disabled:cursor-not-allowed disabled:opacity-60',
        checked ? 'border-transparent bg-accent' : 'border-line-strong bg-surface-3'
      )}
    >
      <span className="ui-switch-thumb" />
    </button>
  )
}
