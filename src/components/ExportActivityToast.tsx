import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { CheckCircle2, ChevronDown, Download, X, XCircle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useExportStore } from '@/store/exportStore'

export function ExportActivityToast(): React.JSX.Element | null {
  const { tasks, activeTaskId, activityRevision, activityVisible, cancelTask, dismissTask, dismissAll } = useExportStore()
  const [expanded, setExpanded] = useState(true)
  const [closing, setClosing] = useState(false)
  const seenCompleted = useRef(new Set<string>())
  const active = tasks.find((task) => task.id === activeTaskId)
  const allSucceeded = tasks.length > 0 && tasks.every((task) => task.status === 'done')

  useEffect(() => {
    if (!activeTaskId) return
    setExpanded(true)
    const timer = setTimeout(() => setExpanded(false), 2_000)
    return () => clearTimeout(timer)
  }, [activeTaskId, activityRevision])

  useEffect(() => {
    const completed = tasks.filter((task) => task.completedAt && !seenCompleted.current.has(task.id))
    if (!completed.length) return
    completed.forEach((task) => seenCompleted.current.add(task.id))
    if (!allSucceeded) setExpanded(true)
  }, [tasks, allSucceeded])

  useEffect(() => {
    if (!activityVisible || !allSucceeded) {
      setClosing(false)
      return
    }
    const closeTimer = setTimeout(() => setClosing(true), 2_100)
    const dismissTimer = setTimeout(dismissAll, 2_400)
    return () => {
      clearTimeout(closeTimer)
      clearTimeout(dismissTimer)
    }
  }, [activityVisible, allSucceeded, dismissAll])

  if (!activityVisible || !tasks.length) return null
  const percent = Math.round((active?.progress ?? 0) * 100)
  const activeOrdinal = active ? tasks.findIndex((task) => task.id === active.id) + 1 : tasks.length
  const doneCount = tasks.filter((task) => task.status === 'done').length
  const errorCount = tasks.filter((task) => task.status === 'error').length
  const queueLabel = `${activeOrdinal}/${tasks.length}`

  return <div className="app-nodrag pointer-events-none fixed left-1/2 top-[68px] z-40 w-[320px] -translate-x-1/2">
    <AnimatePresence mode="wait" initial={false}>
      {!expanded && (active || allSucceeded) ? <motion.button key="compact" initial={{ opacity: 0, scale: 0.94, y: -8 }}
        animate={closing ? { opacity: 0, scale: 0.96, y: -4 } : { opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: closing ? 0.2 : 0.24 }}
        onClick={() => setExpanded(true)}
        aria-label={allSucceeded ? `全部 ${tasks.length} 个视频导出成功` : `展开后台导出详情，第 ${queueLabel} 个，当前 ${percent}%`}
        aria-expanded={false}
        className="pointer-events-auto mx-auto flex h-9 items-center gap-2 rounded-full border border-line-strong bg-surface-1/95 px-3 text-xs text-ink-2 shadow-float backdrop-blur-xl transition-[background-color,border-color,box-shadow] hover:border-accent/35 hover:bg-surface-1 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base active:bg-surface-2">
        <span className="sr-only" aria-live="polite">{allSucceeded ? `全部 ${tasks.length} 个视频导出成功` : ''}</span>
        {allSucceeded
          ? <span className="relative grid h-5 w-5 place-items-center rounded-full bg-success/10 text-success">
            <CheckCircle2 size={14} />
            <SuccessBurst />
          </span>
          : <Download size={13} className="text-accent" />}
        <span className="font-medium text-ink-1">{allSucceeded ? '全部导出完成' : '后台导出'}{' '}
          <span className="font-mono text-ink-3">{allSucceeded ? queueLabel : `${queueLabel} · ${percent}%`}</span>
        </span>
        <span className="h-1 w-12 flex-none overflow-hidden rounded-full bg-surface-3">
          <span className={`block h-full rounded-full transition-[width] ${allSucceeded ? 'bg-success' : 'bg-accent'}`}
            style={{ width: `${allSucceeded ? 100 : percent}%` }} />
        </span>
      </motion.button> : <motion.div key="expanded" initial={{ opacity: 0, y: -8, scale: 0.97 }}
        animate={closing ? { opacity: 0, y: -6, scale: 0.98 } : { opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.98 }} transition={{ duration: closing ? 0.2 : 0.24 }}
        role="status" aria-live="polite"
        className="pointer-events-auto overflow-hidden rounded-2xl border border-line-strong bg-surface-1/95 shadow-float backdrop-blur-xl">
        <button onClick={() => { if (active) setExpanded(false) }} className="flex w-full items-center gap-2 border-b border-line px-3.5 py-3 text-left">
          <AnimatePresence mode="wait" initial={false}>
            {allSucceeded
              ? <motion.span key="success" initial={{ scale: 0.65, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="relative grid h-7 w-7 place-items-center rounded-full bg-success/10 text-success">
                <CheckCircle2 size={16} />
                <SuccessBurst />
              </motion.span>
              : <motion.span key="exporting" className="grid h-7 w-7 place-items-center rounded-full bg-accent-soft text-accent">
                <Download size={14} />
              </motion.span>}
          </AnimatePresence>
          <span className="min-w-0 flex-1">
            <strong className="flex items-center gap-1.5 text-xs font-semibold text-ink-1">
              {allSucceeded ? '全部导出完成' : '后台导出'}
              <span className="rounded-full bg-surface-3 px-1.5 py-0.5 font-mono text-[9px] font-medium text-ink-3">{queueLabel}</span>
            </strong>
            <span className="block truncate text-[10.5px] text-ink-3">{allSucceeded
              ? `${doneCount} 个视频已成功导出`
              : active
              ? `${active.name} · ${percent}%`
              : `已结束 · 成功 ${doneCount}${errorCount ? ` · 失败 ${errorCount}` : ''}`}</span>
            {active && <ProgressBar progress={active.progress} className="mt-1.5" />}
          </span>
          {active && <ChevronDown size={14} className="text-ink-3" />}
        </button>
        <div className="max-h-64 overflow-y-auto p-2">
          {tasks.map((task) => <div key={task.id} className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-surface-2">
            {task.status === 'done' ? <CheckCircle2 size={15} className="text-success" /> : task.status === 'error' ? <XCircle size={15} className="text-danger" /> : <Download size={15} className="text-accent" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11px] font-medium text-ink-1">{task.name}</span>
              <span className="block truncate text-[10px] text-ink-3">{task.status === 'queued' ? '等待导出' : task.status === 'exporting' ? `正在导出 · ${Math.round(task.progress * 100)}%` : task.status === 'done' ? '导出成功' : task.errorMessage}</span>
              {task.status === 'exporting' && <ProgressBar progress={task.progress} className="mt-1.5" />}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button aria-label={task.status === 'done' || task.status === 'error' ? '关闭提示' : '取消导出'}
                  onClick={() => task.status === 'done' || task.status === 'error' ? dismissTask(task.id) : cancelTask(task.id)}
                  className="grid h-6 w-6 place-items-center rounded-md text-ink-3 hover:bg-surface-3 hover:text-ink-1"><X size={12} /></button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {task.status === 'done' || task.status === 'error' ? '关闭提示' : '取消导出'}
              </TooltipContent>
            </Tooltip>
          </div>)}
        </div>
      </motion.div>}
    </AnimatePresence>
  </div>
}

const BURST_PARTICLES = [
  [-18, -12], [0, -18], [18, -12], [22, 2], [15, 16], [0, 20], [-15, 16], [-22, 2]
] as const

function SuccessBurst(): React.JSX.Element | null {
  const reduceMotion = useReducedMotion()
  if (reduceMotion) return null
  return <span aria-hidden="true" className="pointer-events-none absolute inset-0">
    {BURST_PARTICLES.map(([x, y], index) => <motion.span key={`${x}-${y}`}
      className={`absolute left-1/2 top-1/2 h-1 w-1 rounded-full ${index % 2 ? 'bg-accent' : 'bg-success'}`}
      initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
      animate={{ x, y, opacity: [0, 1, 0], scale: [0.4, 1, 0.5] }}
      transition={{ duration: 0.8, delay: index * 0.035, ease: 'easeOut' }} />)}
  </span>
}

function ProgressBar({ progress, className = '' }: { progress: number; className?: string }): React.JSX.Element {
  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100)
  return <span role="progressbar" aria-label="导出进度" aria-valuemin={0} aria-valuemax={100}
    aria-valuenow={percent} className={`block h-1.5 overflow-hidden rounded-full bg-surface-3 ${className}`}>
    <motion.span className="block h-full rounded-full bg-accent"
      initial={false} animate={{ width: `${percent}%` }} transition={{ duration: 0.25, ease: 'easeOut' }} />
  </span>
}
