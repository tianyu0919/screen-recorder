import { useExportStore } from '@/store/exportStore'
import { Button } from '@/components/ui/button'
import { CheckIcon, CloseIcon, DownloadIcon } from '@/components/icons'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * 导出控件（kr-03 Task 3.1 / 3.2）：
 * idle 显示「导出 MP4」按钮；导出中显示进度条 + 百分比 + 取消；
 * 完成显示保存路径与产物格式（H.264 fallback 是 format='webm' 的正常结果，明示而非报错）；
 * 失败显示友好错误。
 */
export function ExportControls(): React.JSX.Element {
  const {
    status,
    progress,
    resultPath,
    outputFormat,
    hasAudio,
    errorMessage,
    startExport,
    cancelExport,
    reset
  } = useExportStore()

  if (status === 'exporting') {
    const percent = Math.round(progress * 100)
    return (
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-32 overflow-hidden rounded bg-surface-3">
          <div className="h-full bg-accent" style={{ width: `${percent}%` }} />
        </div>
        <span className="font-mono text-xs text-ink-2">{percent}%</span>
        <Button variant="ghost" size="sm" onClick={cancelExport}>
          取消
        </Button>
      </div>
    )
  }

  if (status === 'done') {
    const summary = resultPath
      ? `已导出 ${outputFormat?.toUpperCase()}${hasAudio ? '' : ' · 无音轨'}`
      : '已取消保存'
    return (
      <div className="flex flex-none items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              tabIndex={0}
              aria-label={resultPath ? `${summary}，保存位置：${resultPath}` : summary}
              className="flex h-8 max-w-[240px] items-center gap-2 rounded-[10px] border border-line bg-surface-1 px-2.5 text-xs text-ink-2 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span className="grid h-4 w-4 flex-none place-items-center rounded-full bg-success text-on-accent" aria-hidden="true">
                <CheckIcon size={9} />
              </span>
              <span className="truncate whitespace-nowrap">{summary}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8} className="max-w-[380px]">
            <p className="font-medium">{summary}</p>
            {resultPath && <p className="mt-1 break-all font-mono text-[10.5px] text-ink-2">{resultPath}</p>}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 flex-none p-0" onClick={reset} aria-label="关闭导出结果">
              <CloseIcon size={13} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>关闭导出结果</TooltipContent>
        </Tooltip>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-red-300">{errorMessage ?? '导出失败'}</span>
        <Button variant="ghost" size="sm" onClick={reset}>
          关闭
        </Button>
      </div>
    )
  }

  return (
    <Button onClick={() => void startExport()}>
      <DownloadIcon size={14} />
      导出 MP4
    </Button>
  )
}
