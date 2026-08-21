import { usePreviewStore } from '@/store/previewStore'
import { Button } from '@/components/ui/button'
import { CloseIcon } from '@/components/icons'

function fmt(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`
}

/** 检查器·裁剪：已裁区间列表（可单独恢复/全部恢复）；空态给操作引导 */
export function CutsPanel(): React.JSX.Element {
  const { cuts, removeCut, clearCuts } = usePreviewStore()

  return (
    <section className="flex flex-col gap-2.5 border-b border-line px-4 py-3.5">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold tracking-[0.4px] text-ink-3">
          裁剪{cuts.length > 0 ? `（${cuts.length}）` : ''}
        </h3>
        {cuts.length > 1 && (
          <Button variant="ghost" size="sm" onClick={clearCuts}>
            全部恢复
          </Button>
        )}
      </div>
      {cuts.length === 0 ? (
        <p className="text-[11.5px] leading-relaxed text-ink-3">
          在时间轴刻度尺上拖动，框选不需要的部分裁掉；原始录制不受影响。
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {cuts.map((c, i) => (
            <li
              key={`${c.startMs}-${c.endMs}`}
              className="flex items-center justify-between rounded-md border border-line bg-surface-2 px-2.5 py-1.5"
            >
              <span className="font-mono text-[11.5px] text-ink-2">
                {fmt(c.startMs)} → {fmt(c.endMs)}
              </span>
              <button
                onClick={() => removeCut(i)}
                aria-label="恢复此段"
                className="text-ink-3 hover:text-ink-1"
              >
                <CloseIcon size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
