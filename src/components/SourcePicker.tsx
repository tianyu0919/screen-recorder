import { useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import { Button } from '@/components/ui/button'
import { AppWindowIcon, CheckIcon, MonitorIcon, RefreshIcon } from '@/components/icons'
import { cn } from '@/lib/utils'
import type { CaptureSource } from '@shared/types'

function SourceCard({ source }: { source: CaptureSource }): React.JSX.Element {
  const { selectedSourceId, selectSource, status } = useAppStore()
  const selected = selectedSourceId === source.id
  const Icon = source.type === 'screen' ? MonitorIcon : AppWindowIcon
  return (
    <button
      disabled={status !== 'idle'}
      onClick={() => void selectSource(source.id)}
      className={cn(
        'group relative rounded-xl border p-2 text-left transition-colors disabled:opacity-60',
        selected
          ? 'border-accent-border bg-accent-soft shadow-[0_0_0_3px_rgba(255,92,56,0.12)]'
          : 'border-line bg-surface-1 hover:border-line-strong'
      )}
    >
      {source.thumbnail ? (
        <img
          src={source.thumbnail}
          alt={source.name}
          className="aspect-video w-full rounded-lg border border-line object-cover"
        />
      ) : (
        <div className="aspect-video w-full rounded-lg border border-line bg-surface-2" />
      )}
      <div className="flex items-center gap-1.5 px-0.5 pb-0.5 pt-2">
        <Icon size={14} className="text-ink-3" />
        <span className="truncate text-[12.5px] text-ink-1" title={source.name}>
          {source.name}
        </span>
      </div>
      {selected && (
        <span className="absolute right-3.5 top-3.5 flex h-5 items-center gap-1 rounded-full bg-accent px-2 text-[10.5px] font-semibold text-white">
          <CheckIcon size={10} />
          已选择
        </span>
      )}
    </button>
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
    void loadSources()
  }, [loadSources])

  if (!sourcesLoaded) {
    return <p className="text-sm text-ink-3">正在枚举采集源…</p>
  }

  if (sources.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-line p-8">
        <p className="text-sm text-ink-3">无可用采集源</p>
        <Button variant="outline" size="sm" onClick={() => void loadSources()}>
          重试
        </Button>
      </div>
    )
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
    <div className="flex flex-col gap-5">
      {screens.length > 0 && (
        <section>
          <SectionHead title="屏幕" count={`${screens.length} 个显示器`} action={refreshButton} />
          <div className="grid grid-cols-3 gap-3.5 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {screens.map((s) => (
              <SourceCard key={s.id} source={s} />
            ))}
          </div>
        </section>
      )}
      {windows.length > 0 && (
        <section>
          <SectionHead
            title="窗口"
            count={`${windows.length} 个应用窗口`}
            action={screens.length === 0 ? refreshButton : undefined}
          />
          <div className="grid grid-cols-3 gap-3.5 pb-1 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {windows.map((s) => (
              <SourceCard key={s.id} source={s} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
