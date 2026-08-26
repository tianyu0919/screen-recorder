import { CheckIcon, CloseIcon, DownloadIcon, FolderIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useExportStore } from '@/store/exportStore'
import { usePreviewStore } from '@/store/previewStore'
import { createExportSnapshot } from './exportSnapshot'

export function ExportControls(): React.JSX.Element {
  const sessionId = usePreviewStore((state) => state.current?.session.sessionId)
  const { tasks, enqueueExport, enqueueExportToDirectory, cancelTask, dismissTask } = useExportStore()
  const task = [...tasks].reverse().find((item) => item.sessionId === sessionId)
  const enqueue = (pickDirectory: boolean): void => {
    const message = createExportSnapshot()
    if (!message) return
    if (pickDirectory) void enqueueExportToDirectory(message)
    else enqueueExport(message)
  }

  if (task?.status === 'exporting' || task?.status === 'queued') {
    const percent = Math.round(task.progress * 100)
    return <div className="flex items-center gap-2">
      <div className="h-1.5 w-28 overflow-hidden rounded bg-surface-3">
        <div className="h-full bg-accent transition-[width]" style={{ width: `${percent}%` }} />
      </div>
      <span className="font-mono text-xs text-ink-2">
        {task.status === 'queued' ? '等待中' : `${percent}%`}
      </span>
      <Button variant="ghost" size="sm" onClick={() => cancelTask(task.id)}>取消</Button>
    </div>
  }

  if (task?.status === 'done' || task?.status === 'error') {
    const summary = task.status === 'done'
      ? `已导出 ${task.outputFormat?.toUpperCase()}${task.hasAudio ? '' : ' · 无音轨'}`
      : task.errorMessage ?? '导出失败'
    return <div className="flex items-center gap-1.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" disabled={!task.resultPath}
            onClick={() => { if (task.resultPath) void window.api.revealExport(task.resultPath) }}
            aria-label={task.status === 'done' ? '在文件夹中显示导出的视频' : undefined}
            className={`flex h-8 max-w-[240px] items-center gap-2 rounded-[10px] border px-2.5 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base ${task.status === 'done' ? 'border-line bg-surface-1 text-ink-2 transition-colors hover:border-accent/35 hover:bg-surface-2 disabled:pointer-events-none' : 'border-danger/30 bg-danger/5 text-danger'}`}>
            {task.status === 'done' && <span className="grid h-4 w-4 place-items-center rounded-full bg-success text-on-accent"><CheckIcon size={9} /></span>}
            <span className="truncate">{summary}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[380px]">
          <p>{summary}</p>{task.resultPath && <p className="mt-1 break-all font-mono text-[10px]">{task.resultPath}</p>}
          {task.resultPath && <p className="mt-1 text-[10px] text-ink-3">点击在文件夹中显示</p>}
        </TooltipContent>
      </Tooltip>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => dismissTask(task.id)} aria-label="关闭导出结果"><CloseIcon size={13} /></Button>
    </div>
  }

  return <div role="group" aria-label="导出操作"
    className="flex h-9 flex-none items-center gap-0.5 rounded-[12px] border border-line-strong bg-surface-1 p-0.5 shadow-sm">
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" className="h-8 flex-none rounded-[9px] px-3 text-xs text-ink-2 shadow-none"
          onClick={() => enqueue(true)} aria-label="选择其他文件夹并导出 MP4">
          <FolderIcon size={13} />
          另存为
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">选择其他文件夹并导出</TooltipContent>
    </Tooltip>
    <span aria-hidden="true" className="h-4 w-px flex-none bg-line" />
    <Tooltip>
      <TooltipTrigger asChild>
        <Button className="h-8 flex-none rounded-[9px] px-3.5 shadow-none"
          onClick={() => enqueue(false)} aria-label="导出 MP4 到默认位置">
          <DownloadIcon size={14} />
          导出 MP4
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">导出到默认位置</TooltipContent>
    </Tooltip>
  </div>
}
