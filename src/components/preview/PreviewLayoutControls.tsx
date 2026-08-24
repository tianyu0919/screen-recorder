import { Button } from '@/components/ui/button'
import { PanelRightIcon } from '@/components/icons'
import { Expand } from 'lucide-react'
import type { PreviewScaleMode } from '@/lib/stageFit'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import type { PreviewQualityMode } from '@shared/types'
import { PREVIEW_QUALITY_OPTIONS } from '@/store/settingsStore'

interface PreviewLayoutControlsProps {
  scaleMode: PreviewScaleMode
  quality: PreviewQualityMode
  inspectorOpen: boolean
  onEnterFocus(): void
  onScaleModeChange(mode: PreviewScaleMode): void
  onQualityChange(mode: PreviewQualityMode): void
  onToggleInspector(): void
}

const MODES: Array<{ value: PreviewScaleMode; label: string }> = [
  { value: 'fit', label: '适应' },
  { value: 'actual', label: '100%' }
]

/** 编辑器工作区布局控制：预览缩放模式 + 检查器显隐。 */
export function PreviewLayoutControls({
  scaleMode,
  quality,
  inspectorOpen,
  onEnterFocus,
  onScaleModeChange,
  onQualityChange,
  onToggleInspector
}: PreviewLayoutControlsProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-1.5">
      <Select value={quality} onValueChange={(value) => onQualityChange(value as PreviewQualityMode)}>
        <SelectTrigger className="h-7 w-[82px] bg-surface-1 px-2" aria-label="预览清晰度">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {PREVIEW_QUALITY_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
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
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-7 px-0"
            aria-label="进入专注预览"
            onClick={onEnterFocus}
          >
            <Expand size={14} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>专注预览（F）</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-7 px-0"
            aria-label={inspectorOpen ? '收起检查器' : '显示检查器'}
            aria-expanded={inspectorOpen}
            onClick={onToggleInspector}
          >
            <PanelRightIcon size={14} className={cn(!inspectorOpen && 'text-accent')} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{inspectorOpen ? '收起编辑面板' : '展开编辑面板'}</TooltipContent>
      </Tooltip>
    </div>
  )
}
