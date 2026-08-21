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
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-[21px] w-9 flex-none rounded-full border transition-colors disabled:opacity-40',
        checked ? 'border-transparent bg-accent' : 'border-line-strong bg-surface-3'
      )}
    >
      <span
        className={cn(
          'absolute top-[2px] h-[15px] w-[15px] rounded-full transition-all',
          checked ? 'left-[17px] bg-white' : 'left-[2px] bg-[#8e8e96]'
        )}
      />
    </button>
  )
}
