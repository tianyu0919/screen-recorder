import { useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import { SourcePicker } from '@/components/SourcePicker'
import { PermissionGuide } from '@/components/PermissionGuide'
import { RecordingPanel } from '@/components/RecordingPanel'

export default function App(): React.JSX.Element {
  const { permissions, refreshPermissions } = useAppStore()

  useEffect(() => {
    void refreshPermissions()
  }, [refreshPermissions])

  const screenGranted = permissions === null || permissions.screen === 'granted'

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 p-6">
      <header>
        <h1 className="text-xl font-bold">Screen Recorder</h1>
        <p className="text-sm text-zinc-500">录制时记录数据，导出时自动运镜（M1 采集底座）</p>
      </header>

      {permissions && !screenGranted && <PermissionGuide />}
      {permissions && screenGranted && permissions.accessibility !== 'granted' && (
        <PermissionGuide />
      )}

      <SourcePicker />
      <RecordingPanel />
    </main>
  )
}
