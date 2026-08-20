import { useExportStore } from '@/store/exportStore'
import { Button } from '@/components/ui/button'

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
        <div className="h-1.5 w-32 overflow-hidden rounded bg-zinc-800">
          <div className="h-full bg-emerald-500" style={{ width: `${percent}%` }} />
        </div>
        <span className="text-xs text-zinc-400">{percent}%</span>
        <Button variant="ghost" size="sm" onClick={cancelExport}>
          取消
        </Button>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-400">
          {resultPath
            ? `已导出 ${outputFormat?.toUpperCase()}${hasAudio ? '' : '（无音轨）'}：${resultPath}`
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
    <Button variant="outline" size="sm" onClick={() => void startExport()}>
      导出 MP4
    </Button>
  )
}
