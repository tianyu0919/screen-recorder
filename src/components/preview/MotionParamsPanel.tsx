import { usePreviewStore } from '@/store/previewStore'
import type { MotionParams } from '@/timeline/keyframes'
import { ParamRow } from './ParamRow'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { AnimatePresence, motion } from 'motion/react'

/**
 * 检查器·运镜参数（Task 3.3）：全局 目标倍率 / 停留时长 / 回归阈值；
 * 时间轴选中运镜片段后，额外出现「选中片段」区，可单独覆盖该段倍率。
 * 修改即写入 previewStore → 关键帧重新生成 → 播放器与时间轴即时生效。
 */
export function MotionParamsPanel(): React.JSX.Element {
  const {
    motionParams,
    motionEnabled,
    setMotionEnabled,
    setMotionParams,
    motionEffects,
    selectedMotionId,
    setSegmentZoom,
    resetSegmentZoom
  } = usePreviewStore()
  const set = (patch: Partial<MotionParams>): void => setMotionParams(patch)
  const selected = motionEffects.find((effect) => effect.id === selectedMotionId)
  const hasOverride = selected !== undefined && selected.zoom !== motionParams.targetZoom

  return (
    <>
      <section className="flex flex-col gap-3 border-b border-line px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-[11px] font-semibold tracking-[0.4px] text-ink-2">启用运镜</h3>
            <p className="mt-1 text-[10.5px] leading-4 text-ink-3">
              关闭后保持全景，已有片段不会丢失
            </p>
          </div>
          <Switch checked={motionEnabled} onChange={setMotionEnabled} label="启用运镜" />
        </div>
      </section>
      <AnimatePresence initial={false}>
        {motionEnabled && selected && (
          <motion.section
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }}
            className="flex flex-col gap-3 border-b border-line bg-accent-soft/40 px-4 py-3.5"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-semibold tracking-[0.4px] text-accent">选中片段</h3>
              {hasOverride && <Button variant="ghost" size="sm"
                onClick={() => resetSegmentZoom(selected.id)}>恢复全局值</Button>}
            </div>
            <ParamRow label="片段倍率" value={selected.zoom} min={1} max={4} step={0.1}
              format={(v) => `${v.toFixed(1)}x`}
              onChange={(v) => setSegmentZoom(selected.id, v)} />
          </motion.section>
        )}
        {motionEnabled && <motion.section
          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }}
          className="flex flex-col gap-3 border-b border-line px-4 py-3.5"
        >
        <h3 className="text-[11px] font-semibold tracking-[0.4px] text-ink-3">运镜（全局）</h3>
        <ParamRow
          label="目标倍率"
          value={motionParams.targetZoom}
          min={1}
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
        </motion.section>}
      </AnimatePresence>
    </>
  )
}
