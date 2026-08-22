import { cn } from '@/lib/utils'

interface SegmentedProps<T extends string> {
  options: Array<{ value: T; label: string }>
  value: T
  onChange(v: T): void
  className?: string
}

/** 分段选择器（视图切换等）：surface-2 底槽 + surface-3 选中块 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className
}: SegmentedProps<T>): React.JSX.Element {
  return (
    <div
      role="tablist"
      className={cn(
        'flex gap-0.5 rounded-[9px] border border-line bg-surface-2 p-[3px]',
        className
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-md px-4 py-[5px] text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            value === opt.value
              ? 'bg-surface-1 text-ink-1 shadow-sm'
              : 'text-ink-3 hover:text-ink-2'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
