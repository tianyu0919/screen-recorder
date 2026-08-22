import { cn } from '@/lib/utils'

interface ChipProps {
  children: React.ReactNode
  /** 状态点颜色：不传则不渲染圆点 */
  dot?: 'green' | 'amber' | 'red'
  className?: string
}

const dotClass = {
  green: 'status-dot-success',
  amber: 'status-dot-warning',
  red: 'status-dot-danger'
} as const

/** 状态/元信息胶囊（权限状态、会话元信息等） */
export function Chip({ children, dot, className }: ChipProps): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex h-[26px] items-center gap-1.5 rounded-full border border-line bg-surface-2 px-[11px] text-xs text-ink-2',
        className
      )}
    >
      {dot && <span className={cn('h-[7px] w-[7px] rounded-full', dotClass[dot])} />}
      {children}
    </span>
  )
}
