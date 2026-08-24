import { useExportStore } from '@/store/exportStore'
import { Button } from '@/components/ui/button'
import { DownloadIcon } from '@/components/icons'

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
    outputSize,
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
        <span className="font-mono text-xs text-ink-2">
          {percent}%{outputSize ? ` · ${outputSize.width}×${outputSize.height}` : ''}
        </span>
        <Button variant="ghost" size="sm" onClick={cancelExport}>
          取消
        </Button>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div className="flex items-center gap-2">
        <span className="max-w-[320px] truncate text-xs text-ink-2" title={resultPath ?? ''}>
          {resultPath
            ? `已导出 ${outputFormat?.toUpperCase()} · ${outputSize?.width ?? '?'}×${outputSize?.height ?? '?'}${hasAudio ? '' : '（无音轨）'}：${resultPath}`
            : '已取消保存'}
        </span>
        <Button variant="ghost" size="sm" onClick={reset}>
          关闭
        </Button>
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
