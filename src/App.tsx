import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore, type AppView } from '@/store/appStore'
import { SourcePicker } from '@/components/SourcePicker'
import { PermissionGuide } from '@/components/PermissionGuide'
import { RecordingPanel } from '@/components/RecordingPanel'
import { Segmented } from '@/components/ui/segmented'
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
import { PermissionStatusChips } from '@/components/PermissionStatusChips'
import { Toaster } from '@/components/ui/sonner'
import { useThemeStore } from '@/store/themeStore'
import { ExportActivityToast } from '@/components/ExportActivityToast'

const PreviewScreen = lazy(async () => {
  const module = await loadPreviewScreen()
  return { default: module.PreviewScreen }
})

const VIEW_OPTIONS: Array<{ value: AppView; label: string }> = [
  { value: 'record', label: '录制' },
  { value: 'preview', label: '预览' }
]

export default function App(): React.JSX.Element {
  const { view, setView, permissions, refreshPermissions, status } = useAppStore()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [focusPreview, setFocusPreview] = useState(false)
  const focusEntryMaximizedRef = useRef<boolean | null>(null)
  const focusTransitionRef = useRef(0)
  const loadSettings = useSettingsStore((state) => state.load)
  const initializeUpdates = useUpdateStore((state) => state.initialize)
  const theme = useThemeStore((state) => state.mode)

  useEffect(() => {
    void refreshPermissions()
    void loadSettings()
    void initializeUpdates()
  }, [refreshPermissions, loadSettings, initializeUpdates])

  const changeFocusPreview = useCallback((active: boolean): void => {
    const transition = ++focusTransitionRef.current
    if (active) {
      void window.api.windowIsMaximized().then((maximized) => {
        if (focusTransitionRef.current !== transition) return
        focusEntryMaximizedRef.current = maximized
        setFocusPreview(true)
      })
      return
    }

    const entryMaximized = focusEntryMaximizedRef.current
    focusEntryMaximizedRef.current = null
    if (entryMaximized === null) {
      setFocusPreview(false)
      return
    }
    void window.api.windowSetMaximized(entryMaximized).finally(() => {
      if (focusTransitionRef.current === transition) setFocusPreview(false)
    })
  }, [])

  useEffect(() => {
    if (view !== 'preview') changeFocusPreview(false)
  }, [changeFocusPreview, view])

  const hasMissingPermission =
    permissions !== null &&
    (permissions.screen !== 'granted' ||
      permissions.accessibility !== 'granted' ||
      permissions.microphone !== 'granted')
  return (
    <TooltipProvider delayDuration={180} skipDelayDuration={80}>
    <main className="flex h-screen flex-col overflow-hidden bg-base">
      {!focusPreview && <AppHeader onOpenSettings={() => setSettingsOpen(true)} />}

      {/* 内容区顶行：左侧权限状态标签（录制页），右侧视图切换 */}
      {!focusPreview && <div className="flex flex-none items-center justify-between px-6 pb-2 pt-3">
        <div>{view === 'record' && permissions && <PermissionStatusChips permissions={permissions} />}</div>
        <Segmented options={VIEW_OPTIONS} value={view} onChange={setView} onIntent={(target) => { if (target === 'preview') preloadPreview() }} />
      </div>}

      <MotionConfig reducedMotion="user" transition={{ type: 'spring', stiffness: 420, damping: 32 }}>
      <AnimatePresence mode="wait">
      {view === 'record' ? (
        <motion.div key="record" variants={viewTransition} initial="initial" animate="enter" exit="exit" className="flex flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6">
            {hasMissingPermission && <PermissionGuide />}
            <SourcePicker />
          </div>

          <RecordingPanel />
        </motion.div>
      ) : (
        <motion.div key="preview" variants={viewTransition} initial="initial" animate="enter" exit="exit" className="flex min-h-0 flex-1 flex-col">
          <PreviewLoadBoundary onBack={() => setView('record')} onRetry={() => window.location.reload()} canReload={status === 'idle'}>
            <Suspense fallback={<PreviewLoadingState />}>
              <PreviewScreen focusMode={focusPreview} onFocusModeChange={changeFocusPreview} />
            </Suspense>
          </PreviewLoadBoundary>
        </motion.div>
      )}
      </AnimatePresence>
      </MotionConfig>
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <CloseConfirmDialog />
      <ExportActivityToast />
      <Toaster position="top-center" theme={theme} closeButton />
    </main>
    </TooltipProvider>
  )
}
