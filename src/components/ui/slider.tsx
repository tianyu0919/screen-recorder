import { cn } from '@/lib/utils'

interface SliderProps {
  value: number
  min: number
  max: number
  step?: number
  disabled?: boolean
  onChange(v: number): void
  className?: string
  ariaLabel?: string
}

/** 设计稿滑杆：轨道 4px，已选段强调橙填充，白色圆形手柄（样式见 index.css .ui-slider） */
export function Slider({
  value,
  min,
  max,
  step = 1,
  disabled,
  onChange,
  className,
  ariaLabel
}: SliderProps): React.JSX.Element {
  const percent = max > min ? ((value - min) / (max - min)) * 100 : 0
  return (
    <input
      type="range"
      aria-label={ariaLabel}
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      // min-w-0：Chromium 给 range 输入约 129px 的默认最小宽，flex 布局里必须允许收缩
      className={cn('ui-slider min-w-0', className)}
      style={{
        background: `linear-gradient(to right, var(--accent) ${percent}%, var(--surface-3) ${percent}%)`
      }}
    />
  )
}
