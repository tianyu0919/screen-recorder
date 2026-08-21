import { cn } from '@/lib/utils'

/** 应用 Logo：橙色渐变圆角方块 + 屏幕/镜头白标（与 build/icon.svg 同一设计语言） */
export function AppLogo({ size = 28, className }: { size?: number; className?: string }): React.JSX.Element {
  return (
    <span
      className={cn('grid place-items-center rounded-lg', className)}
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(140deg, #ff7a52, #e83e1a)',
        boxShadow: '0 2px 10px rgba(255,92,56,0.35)'
      }}
    >
      <svg
        width={size * 0.56}
        height={size * 0.56}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="4" width="20" height="14" rx="3" />
        <circle cx="12" cy="11" r="3.2" />
      </svg>
    </span>
  )
}
