import { useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** 采集源选择面板（Task 2.1） */
export function SourcePicker(): React.JSX.Element {
  const { sources, sourcesLoaded, selectedSourceId, selectSource, loadSources, status } =
    useAppStore()

  useEffect(() => {
    void loadSources()
  }, [loadSources])

  if (!sourcesLoaded) {
    return <p className="text-sm text-zinc-400">正在枚举采集源…</p>
  }

  if (sources.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-zinc-800 p-8">
        <p className="text-sm text-zinc-400">无可用采集源</p>
        <Button variant="outline" size="sm" onClick={() => void loadSources()}>
          重试
        </Button>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-300">选择屏幕 / 窗口</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void loadSources()}
          disabled={status !== 'idle'}
        >
          刷新
        </Button>
      </div>
      <div className="grid max-h-72 grid-cols-3 gap-3 overflow-y-auto pr-1">
        {sources.map((s) => (
          <button
            key={s.id}
            disabled={status !== 'idle'}
            onClick={() => selectSource(s.id)}
            className={cn(
              'group rounded-lg border p-2 text-left transition-colors',
              selectedSourceId === s.id
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-zinc-800 hover:border-zinc-600'
            )}
          >
            {s.thumbnail ? (
              <img src={s.thumbnail} alt={s.name} className="aspect-video w-full rounded object-cover" />
            ) : (
              <div className="aspect-video w-full rounded bg-zinc-800" />
            )}
            <p className="mt-1 truncate text-xs text-zinc-300" title={s.name}>
              <span className="mr-1 text-zinc-500">{s.type === 'screen' ? '🖥' : '🪟'}</span>
              {s.name}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}
