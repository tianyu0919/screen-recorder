import { lazy, Suspense, useEffect, useState } from 'react'
import { useAppStore, type AppView } from '@/store/appStore'
import { SourcePicker } from '@/components/SourcePicker'
import { PermissionGuide } from '@/components/PermissionGuide'
import { RecordingPanel } from '@/components/RecordingPanel'
import { Segmented } from '@/components/ui/segmented'
import { Chip } from '@/components/ui/chip'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { viewTransition } from '@/lib/motion'
import { SettingsPanel } from '@/components/settings/SettingsPanel'
import { CloseConfirmDialog } from '@/components/CloseConfirmDialog'
import { useSettingsStore } from '@/store/settingsStore'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useUpdateStore } from '@/store/updateStore'
import { loadPreviewScreen, preloadPreview } from '@/lib/previewLoader'
import { PreviewLoadingState } from '@/components/preview/PreviewLoadingState'
import { PreviewLoadBoundary } from '@/components/preview/PreviewLoadBoundary'
import { AppHeader } from '@/components/AppHeader'

const PreviewScreen = lazy(async () => {
  const module = await loadPreviewScreen()
  return { default: module.PreviewScreen }
})

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
  const { view, setView, permissions, refreshPermissions, status } = useAppStore()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const loadSettings = useSettingsStore((state) => state.load)
  const initializeUpdates = useUpdateStore((state) => state.initialize)

  useEffect(() => {
    void refreshPermissions()
    void loadSettings()
    void initializeUpdates()
  }, [refreshPermissions, loadSettings, initializeUpdates])

  const screenGranted = permissions === null || permissions.screen === 'granted'
  return (
    <TooltipProvider delayDuration={180} skipDelayDuration={80}>
    <main className="flex h-screen flex-col overflow-hidden bg-base">
      <AppHeader onOpenSettings={() => setSettingsOpen(true)} />

      {/* 内容区顶行：左侧权限状态标签（录制页），右侧视图切换 */}
      <div className="flex flex-none items-center justify-between px-6 pb-2 pt-3">
        <div className="flex gap-2">
          {view === 'record' &&
            permissions &&
            PERMISSION_ITEMS.map((item) => (
              <Chip key={item.key} dot={permissions[item.key] === 'granted' ? 'green' : 'amber'}>
                {item.label}
                {permissions[item.key] === 'granted' ? '已授权' : '未授权'}
              </Chip>
            ))}
        </div>
        <Segmented options={VIEW_OPTIONS} value={view} onChange={setView} onIntent={(target) => { if (target === 'preview') preloadPreview() }} />
      </div>

      <MotionConfig reducedMotion="user" transition={{ type: 'spring', stiffness: 420, damping: 32 }}>
      <AnimatePresence mode="wait" initial={false}>
      {view === 'record' ? (
        <motion.div key="record" variants={viewTransition} initial="initial" animate="enter" exit="exit" className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6">
            {permissions && !screenGranted && <PermissionGuide />}
            {permissions && screenGranted && permissions.accessibility !== 'granted' && (
              <PermissionGuide />
            )}
            <SourcePicker />
          </div>

          <RecordingPanel />
        </motion.div>
      ) : (
        <motion.div key="preview" variants={viewTransition} initial="initial" animate="enter" exit="exit" className="flex min-h-0 flex-1 flex-col">
          <PreviewLoadBoundary onBack={() => setView('record')} onRetry={() => window.location.reload()} canReload={status === 'idle'}>
            <Suspense fallback={<PreviewLoadingState />}><PreviewScreen /></Suspense>
          </PreviewLoadBoundary>
        </motion.div>
      )}
      </AnimatePresence>
      </MotionConfig>
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <CloseConfirmDialog />
    </main>
    </TooltipProvider>
  )
}
