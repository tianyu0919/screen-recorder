import { usePreviewStore } from '@/store/previewStore'
import type { MotionParams } from '@/timeline/keyframes'

interface ParamRowProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (v: number) => string
  onChange(v: number): void
}

function ParamRow({ label, value, min, max, step, format, onChange }: ParamRowProps) {
  return (
    <label className="flex items-center gap-3 text-sm text-zinc-300">
      <span className="w-16 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 flex-1 cursor-pointer accent-zinc-300"
      />
      <span className="w-16 shrink-0 text-right font-mono text-xs text-zinc-400">
        {format(value)}
      </span>
    </label>
  )
}

/**
 * 运镜参数调节面板（Task 3.3）：目标倍率 / 停留时长 / 回归阈值。
 * 修改即写入 previewStore → 关键帧重新生成 → 播放器即时生效。
 */
export function MotionParamsPanel(): React.JSX.Element {
  const { motionParams, setMotionParams } = usePreviewStore()
  const set = (patch: Partial<MotionParams>): void => setMotionParams(patch)

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-800 p-4">
      <h3 className="text-sm font-medium text-zinc-200">运镜参数</h3>
      <ParamRow
        label="目标倍率"
        value={motionParams.targetZoom}
        min={1.2}
        max={4}
        step={0.1}
        format={(v) => `${v.toFixed(1)}x`}
        onChange={(v) => set({ targetZoom: v })}
      />
      <ParamRow
        label="停留时长"
        value={motionParams.dwellMs}
        min={300}
        max={5000}
        step={100}
        format={(v) => `${(v / 1000).toFixed(1)}s`}
        onChange={(v) => set({ dwellMs: v })}
      />
      <ParamRow
        label="回归阈值"
        value={motionParams.returnThresholdMs}
        min={1000}
        max={10000}
        step={250}
        format={(v) => `${(v / 1000).toFixed(1)}s`}
        onChange={(v) => set({ returnThresholdMs: v })}
      />
    </div>
  )
}
