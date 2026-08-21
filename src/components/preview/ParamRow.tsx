import { Slider } from '@/components/ui/slider'

interface ParamRowProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (v: number) => string
  onChange(v: number): void
  /** 无对应数据时禁用（如会话缺少该音轨） */
  disabled?: boolean
}

/** 检查器参数行：标签 + 滑杆 + 数值读数（运镜/音频面板共用） */
export function ParamRow({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
  disabled
}: ParamRowProps): React.JSX.Element {
  return (
    <div className={`flex items-center gap-3 ${disabled ? 'opacity-40' : ''}`}>
      <span className="w-16 flex-none text-[12.5px] text-ink-1">{label}</span>
      <Slider
        className="flex-1"
        ariaLabel={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
      <span className="w-12 flex-none text-right font-mono text-[11.5px] text-ink-2">
        {format(value)}
      </span>
    </div>
  )
}
