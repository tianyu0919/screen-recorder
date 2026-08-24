import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { Button } from '@/components/ui/button'
import { AppWindowIcon, CheckIcon, MonitorIcon, RefreshIcon } from '@/components/icons'
import { cn } from '@/lib/utils'
import type { CaptureSource } from '@shared/types'
import { motion, useReducedMotion } from 'motion/react'
import { staggerContainer, staggerItem, viewTransition } from '@/lib/motion'
import { useGridFlip } from '@/hooks/useGridFlip'

const INITIAL_SOURCE_LOAD_DELAY_MS = 350

function SourceLoadingState(): React.JSX.Element {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      role="status"
      aria-live="polite"
      aria-busy="true"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: 0.12, ease: 'easeOut' }}
      className="flex min-h-[320px] flex-1 items-center justify-center py-12"
    >
      <div className="flex max-w-xs flex-col items-center text-center">
        <div className="relative mb-4 grid h-16 w-16 place-items-center" aria-hidden="true">
          <span className="absolute inset-1 rounded-full border-2 border-line" />
          <motion.span
            className="absolute inset-1 rounded-full border-2 border-transparent border-t-accent will-change-transform"
            animate={reduceMotion ? { opacity: 0.65 } : { rotate: 360 }}
            transition={reduceMotion ? { duration: 0.15 } : { duration: 0.82, repeat: Infinity, ease: 'linear' }}
          />
          <span className="grid h-10 w-10 place-items-center rounded-2xl border border-line bg-surface-1 text-accent shadow-card">
            <MonitorIcon size={18} />
          </span>
        </div>
        <p className="text-sm font-semibold text-ink-1">正在查找可录制内容</p>
        <p className="mt-1.5 text-xs leading-5 text-ink-3">正在获取屏幕与应用窗口，请稍候</p>
      </div>
    </motion.div>
  )
}

function SourceEmptyState({ onRetry }: { onRetry: () => void }): React.JSX.Element {
  return (
    <motion.div variants={viewTransition} initial="initial" animate="enter" className="flex min-h-[320px] flex-1 items-center justify-center py-12">
      <div className="flex max-w-xs flex-col items-center text-center">
        <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-line bg-surface-1 text-ink-3 shadow-card" aria-hidden="true">
          <MonitorIcon size={20} />
        </span>
        <p className="text-sm font-semibold text-ink-1">没有找到可录制内容</p>
        <p className="mt-1.5 text-xs leading-5 text-ink-3">请确认屏幕录制权限，或打开需要录制的应用窗口</p>
        <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={onRetry}>
          <RefreshIcon size={13} aria-hidden="true" />
          重新查找
        </Button>
      </div>
    </motion.div>
  )
}

function SourceThumbnail({ source }: { source: CaptureSource }): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  const Icon = source.type === 'screen' ? MonitorIcon : AppWindowIcon

  useEffect(() => {
    setFailed(false)
  }, [source.thumbnail])

  if (!source.thumbnail || failed) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center rounded-lg border border-line bg-surface-2 text-ink-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface-1 shadow-card" aria-hidden="true">
          <Icon size={18} />
        </span>
        <span className="mt-2 text-[11px]">预览暂不可用</span>
      </div>
    )
  }

  return (
    <img
      src={source.thumbnail}
      alt=""
      draggable={false}
      onError={() => setFailed(true)}
      className="aspect-video w-full rounded-lg border border-line object-cover"
    />
  )
}

function SourceCard({ source }: { source: CaptureSource }): React.JSX.Element {
  const { selectedSourceId, selectSource, status } = useAppStore()
  const selected = selectedSourceId === source.id
  const Icon = source.type === 'screen' ? MonitorIcon : AppWindowIcon
  return (
    <div data-grid-flip-item={source.id} className="min-w-0">
      <motion.button
        variants={staggerItem}
        whileHover={status === 'idle' ? { y: -4 } : undefined}
        whileTap={status === 'idle' ? { scale: 0.985 } : undefined}
        disabled={status !== 'idle'}
        aria-pressed={selected}
        title={selected ? '再次点击取消选择' : source.name}
        onClick={() => void selectSource(source.id)}
        className={cn(
          'group relative w-full rounded-2xl border bg-surface-1 p-2.5 text-left shadow-card transition-[border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60',
          selected
            ? 'border-accent-border bg-accent-soft shadow-[0_0_0_3px_rgba(255,92,56,0.12)]'
            : 'border-line hover:border-line-strong hover:shadow-float'
        )}
      >
        <SourceThumbnail source={source} />
        <div className="flex items-center gap-1.5 px-0.5 pb-0.5 pt-2">
          <Icon size={14} className="text-ink-3" />
          <span className="truncate text-[12.5px] text-ink-1" title={source.name}>
            {source.name}
          </span>
        </div>
        {selected && (
          <span className="selected-badge absolute right-3.5 top-3.5 flex h-5 items-center gap-1 rounded-full bg-accent px-2 text-[10.5px] font-semibold">
            <CheckIcon size={10} />
            已选择
          </span>
        )}
      </motion.button>
    </div>
  )
}

function SourceGrid({ sources, className }: { sources: CaptureSource[]; className?: string }): React.JSX.Element {
  const itemKey = sources.map((source) => source.id).join('|')
  const gridRef = useGridFlip(itemKey)
  return (
    <motion.div
      ref={gridRef}
      variants={staggerContainer}
      initial="initial"
      animate="enter"
      className={cn('grid grid-cols-3 gap-3.5 md:grid-cols-4 xl:grid-cols-5 min-[1360px]:grid-cols-6', className)}
    >
      {sources.map((source) => <SourceCard key={source.id} source={source} />)}
    </motion.div>
  )
}

function SectionHead({
  title,
  count,
  action
}: {
  title: string
  count: string
  action?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="text-[13px] font-semibold text-ink-2">{title}</h2>
      <div className="flex items-center gap-2">
        <span className="text-xs text-ink-3">{count}</span>
        {action}
      </div>
    </div>
  )
}

/** 采集源选择面板（Task 2.1） */
export function SourcePicker(): React.JSX.Element {
  const { sources, sourcesLoaded, loadSources, status } = useAppStore()

  useEffect(() => {
    // 窗口刚显示时系统合成器可能尚未准备好缩略图；稍后枚举可避免首屏空白，手动刷新仍即时执行。
    const timer = window.setTimeout(() => void loadSources(), INITIAL_SOURCE_LOAD_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [loadSources])

  if (!sourcesLoaded) {
    return <SourceLoadingState />
  }

  if (sources.length === 0) {
    return <SourceEmptyState onRetry={() => void loadSources()} />
  }

  const screens = sources.filter((s) => s.type === 'screen')
  const windows = sources.filter((s) => s.type === 'window')

  const refreshButton = (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => void loadSources()}
      disabled={status !== 'idle'}
    >
      <RefreshIcon size={13} />
      刷新列表
    </Button>
  )

  return (
    <motion.div variants={viewTransition} initial="initial" animate="enter" className="flex flex-col gap-5">
      {screens.length > 0 && (
        <section>
          <SectionHead title="屏幕" count={`${screens.length} 个显示器`} action={refreshButton} />
          <SourceGrid sources={screens} />
        </section>
      )}
      {windows.length > 0 && (
        <section>
          <SectionHead
            title="窗口"
            count={`${windows.length} 个应用窗口`}
            action={screens.length === 0 ? refreshButton : undefined}
          />
          <SourceGrid sources={windows} className="pb-1" />
        </section>
      )}
    </motion.div>
  )
}
