import { cn } from '@/lib/utils'

interface ChipProps {
  children: React.ReactNode
  /** 状态点颜色：不传则不渲染圆点 */
  dot?: 'green' | 'amber' | 'red'
  className?: string
}

const dotClass = {
  green: 'bg-[#30d158] shadow-[0_0_6px_rgba(48,209,88,0.6)]',
  amber: 'bg-[#ffd60a] shadow-[0_0_6px_rgba(255,214,10,0.5)]',
  red: 'bg-[#ff453a] shadow-[0_0_6px_rgba(255,69,58,0.5)]'
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
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dotClass[dot])} />}
      {children}
    </span>
  )
}
