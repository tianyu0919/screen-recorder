import { usePreviewStore } from '@/store/previewStore'
import type { MotionParams } from '@/timeline/keyframes'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'

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
    <div className="flex items-center gap-3">
      <span className="w-16 flex-none text-[12.5px] text-ink-1">{label}</span>
      <Slider
        className="flex-1"
        ariaLabel={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
      />
      <span className="w-12 flex-none text-right font-mono text-[11.5px] text-ink-2">
        {format(value)}
      </span>
    </div>
  )
}

/**
 * 检查器·运镜参数（Task 3.3）：全局 目标倍率 / 停留时长 / 回归阈值；
 * 时间轴选中运镜片段后，额外出现「选中片段」区，可单独覆盖该段倍率（写 zoomOverrides）。
 * 修改即写入 previewStore → 关键帧重新生成 → 播放器与时间轴即时生效。
 */
export function MotionParamsPanel(): React.JSX.Element {
  const {
    motionParams,
    setMotionParams,
    keyframes,
    selectedSegmentT,
    zoomOverrides,
    setSegmentZoom,
    resetSegmentZoom
  } = usePreviewStore()
  const set = (patch: Partial<MotionParams>): void => setMotionParams(patch)
  const segKf =
    selectedSegmentT !== null ? keyframes.find((k) => k.t === selectedSegmentT) : undefined
  const hasOverride = segKf !== undefined && zoomOverrides[segKf.t] !== undefined

  return (
    <>
      {segKf && (
        <section className="flex flex-col gap-3 border-b border-line bg-accent-soft/40 px-4 py-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-semibold tracking-[0.4px] text-accent">选中片段</h3>
            {hasOverride && (
              <Button variant="ghost" size="sm" onClick={() => resetSegmentZoom(segKf.t)}>
                恢复全局值
              </Button>
            )}
          </div>
          <ParamRow
            label="片段倍率"
            value={segKf.target.zoom}
            min={1.2}
            max={4}
            step={0.1}
            format={(v) => `${v.toFixed(1)}x`}
            onChange={(v) => setSegmentZoom(segKf.t, v)}
          />
        </section>
      )}
      <section className="flex flex-col gap-3 border-b border-line px-4 py-3.5">
        <h3 className="text-[11px] font-semibold tracking-[0.4px] text-ink-3">运镜（全局）</h3>
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
      </section>
    </>
  )
}
