import { useEffect, useState } from 'react'
import { useAppStore, type AppView } from '@/store/appStore'
import { SourcePicker } from '@/components/SourcePicker'
import { PermissionGuide } from '@/components/PermissionGuide'
import { RecordingPanel } from '@/components/RecordingPanel'
import { PreviewScreen } from '@/components/preview/PreviewScreen'
import { AppLogo } from '@/components/AppLogo'
import { Segmented } from '@/components/ui/segmented'
import { Chip } from '@/components/ui/chip'
import { WindowControls } from '@/components/WindowControls'
import { ThemeSwitch } from '@/components/ThemeSwitch'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { viewTransition } from '@/lib/motion'
import { Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SettingsPanel } from '@/components/settings/SettingsPanel'
import { CloseConfirmDialog } from '@/components/CloseConfirmDialog'
import { useSettingsStore } from '@/store/settingsStore'
import { TooltipProvider } from '@/components/ui/tooltip'
import { UpdateControl } from '@/components/UpdateControl'
import { useUpdateStore } from '@/store/updateStore'

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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const loadSettings = useSettingsStore((state) => state.load)
  const initializeUpdates = useUpdateStore((state) => state.initialize)

  useEffect(() => {
    void refreshPermissions()
    void loadSettings()
    void initializeUpdates()
  }, [refreshPermissions, loadSettings, initializeUpdates])

  const screenGranted = permissions === null || permissions.screen === 'granted'
  const isMac = window.api.platform === 'darwin'
  const isWin = window.api.platform === 'win32'

  return (
    <TooltipProvider delayDuration={180} skipDelayDuration={80}>
    <main className="flex h-screen flex-col overflow-hidden bg-base">
      {/* macOS 红绿灯拖拽区（hiddenInset 标题栏）；Windows 拖拽由 header 提供 */}
      {isMac && <div className="app-drag h-10 flex-none" />}

      <header
        className="app-drag flex flex-none items-center justify-between px-6 pb-1 pt-2"
        onDoubleClick={(e) => {
          // 双击 header 空白处切换最大化（Windows，模拟原生标题栏行为）
          if (isWin && e.target === e.currentTarget) void window.api.windowToggleMaximize()
        }}
      >
        <div className="flex items-center gap-2.5">
          <AppLogo />
          <div>
            <h1 className="text-[15px] font-semibold leading-tight">Lenza</h1>
            <p className="text-[11.5px] text-ink-3">录制时采集数据，导出时自动运算</p>
          </div>
        </div>
        <div className="app-nodrag flex items-center gap-1.5">
          <UpdateControl />
          <ThemeSwitch />
          <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)} aria-label="打开应用设置"><Settings size={14} /></Button>
          <WindowControls />
        </div>
      </header>

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
        <Segmented options={VIEW_OPTIONS} value={view} onChange={setView} />
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
          <PreviewScreen />
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
