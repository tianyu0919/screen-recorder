import { useEffect } from 'react'
import { useAppStore, type AppView } from '@/store/appStore'
import { SourcePicker } from '@/components/SourcePicker'
import { PermissionGuide } from '@/components/PermissionGuide'
import { RecordingPanel } from '@/components/RecordingPanel'
import { PreviewScreen } from '@/components/preview/PreviewScreen'
import { AppLogo } from '@/components/AppLogo'
import { Segmented } from '@/components/ui/segmented'
import { Chip } from '@/components/ui/chip'

const VIEW_OPTIONS: Array<{ value: AppView; label: string }> = [
  { value: 'record', label: '录制' },
  { value: 'preview', label: '预览' }
]

const PERMISSION_ITEMS: Array<{ key: 'screen' | 'accessibility' | 'microphone'; label: string }> = [
  { key: 'screen', label: '屏幕录制' },
  { key: 'accessibility', label: '辅助功能' },
  { key: 'microphone', label: '麦克风' }
]

export default function App(): React.JSX.Element {
  const { view, setView, permissions, refreshPermissions } = useAppStore()

  useEffect(() => {
    void refreshPermissions()
  }, [refreshPermissions])

  const screenGranted = permissions === null || permissions.screen === 'granted'
  const isMac = window.api.platform === 'darwin'

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-base">
      {/* macOS 红绿灯拖拽区（hiddenInset 标题栏）；Windows 为原生标题栏无需此区 */}
      {isMac && <div className="app-drag h-10 flex-none" />}

      <header className="app-drag flex flex-none items-center justify-between px-6 pb-1">
        <div className="flex items-center gap-2.5">
          <AppLogo />
          <div>
            <h1 className="text-[15px] font-semibold leading-tight">Lenza</h1>
            <p className="text-[11.5px] text-ink-3">录制时采集数据，导出时自动运镜</p>
          </div>
        </div>
        <div className="app-nodrag">
          <Segmented options={VIEW_OPTIONS} value={view} onChange={setView} />
        </div>
      </header>

      {view === 'record' ? (
        <div className="flex flex-1 flex-col overflow-hidden">
          {permissions && (
            <div className="flex flex-none gap-2 px-6 pb-4 pt-3">
              {PERMISSION_ITEMS.map((item) => (
                <Chip
                  key={item.key}
                  dot={permissions[item.key] === 'granted' ? 'green' : 'amber'}
                >
                  {item.label}
                  {permissions[item.key] === 'granted' ? '已授权' : '未授权'}
                </Chip>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-6">
            {permissions && !screenGranted && <PermissionGuide />}
            {permissions && screenGranted && permissions.accessibility !== 'granted' && (
              <PermissionGuide />
            )}
            <SourcePicker />
          </div>

          <RecordingPanel />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <PreviewScreen />
        </div>
      )}
    </main>
  )
}
