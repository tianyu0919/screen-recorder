import { Button } from '@/components/ui/button'
import { PanelRightIcon } from '@/components/icons'
import type { PreviewScaleMode } from '@/lib/stageFit'
import { cn } from '@/lib/utils'

interface PreviewLayoutControlsProps {
  scaleMode: PreviewScaleMode
  inspectorOpen: boolean
  onScaleModeChange(mode: PreviewScaleMode): void
  onToggleInspector(): void
}

const MODES: Array<{ value: PreviewScaleMode; label: string }> = [
  { value: 'fit', label: '适应' },
  { value: 'actual', label: '100%' }
]

/** 编辑器工作区布局控制：预览缩放模式 + 检查器显隐。 */
export function PreviewLayoutControls({
  scaleMode,
  inspectorOpen,
  onScaleModeChange,
  onToggleInspector
}: PreviewLayoutControlsProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-1.5">
      <div
        role="group"
        aria-label="预览缩放"
        className="flex rounded-lg border border-line bg-surface-2 p-0.5"
      >
        {MODES.map((mode) => (
          <button
            key={mode.value}
            type="button"
            aria-pressed={scaleMode === mode.value}
            onClick={() => onScaleModeChange(mode.value)}
            className={cn(
              'h-6 rounded-md px-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
              scaleMode === mode.value
                ? 'bg-surface-3 text-ink-1 shadow-sm'
                : 'text-ink-3 hover:text-ink-1'
            )}
          >
            {mode.label}
          </button>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-7 px-0"
        aria-label={inspectorOpen ? '收起检查器' : '显示检查器'}
        aria-expanded={inspectorOpen}
        title={inspectorOpen ? '收起检查器' : '显示检查器'}
        onClick={onToggleInspector}
      >
        <PanelRightIcon size={14} className={cn(!inspectorOpen && 'text-accent')} />
      </Button>
    </div>
  )
}
