import { useEffect } from 'react'
import { useAppStore, type AppView } from '@/store/appStore'
import { SourcePicker } from '@/components/SourcePicker'
import { PermissionGuide } from '@/components/PermissionGuide'
import { RecordingPanel } from '@/components/RecordingPanel'
import { PreviewScreen } from '@/components/preview/PreviewScreen'
import { cn } from '@/lib/utils'

function ViewTab({ view, label }: { view: AppView; label: string }): React.JSX.Element {
  const { view: current, setView } = useAppStore()
  return (
    <button
      onClick={() => setView(view)}
      className={cn(
        'rounded-md px-3 py-1 text-sm',
        current === view ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
      )}
    >
      {label}
    </button>
  )
}

export default function App(): React.JSX.Element {
  const { view, permissions, refreshPermissions } = useAppStore()

  useEffect(() => {
    void refreshPermissions()
  }, [refreshPermissions])

  const screenGranted = permissions === null || permissions.screen === 'granted'

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 p-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold">Screen Recorder</h1>
          <p className="text-sm text-zinc-500">录制时记录数据，导出时自动运镜</p>
        </div>
        <nav className="flex gap-1">
          <ViewTab view="record" label="录制" />
          <ViewTab view="preview" label="预览" />
        </nav>
      </header>

      {view === 'record' ? (
        <>
          {permissions && !screenGranted && <PermissionGuide />}
          {permissions && screenGranted && permissions.accessibility !== 'granted' && (
            <PermissionGuide />
          )}
          <SourcePicker />
          <RecordingPanel />
        </>
      ) : (
        <PreviewScreen />
      )}
    </main>
  )
}
