import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUpCircle, FolderOpen, RefreshCw, Settings, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  CLOSE_OPTIONS, RETENTION_OPTIONS, THEME_OPTIONS, useSettingsStore
} from '@/store/settingsStore'
import { Switch } from '@/components/ui/switch'
import { useUpdateStore } from '@/store/updateStore'
import type { UpdateStatus } from '@shared/types'

interface SettingsPanelProps {
  open: boolean
  onClose(): void
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps): React.JSX.Element {
  const { settings, loading, error, update, chooseRecordingsPath, openRecordingsPath,
    chooseExportPath, openExportPath } = useSettingsStore()
  const { snapshot, check, setOpen: setUpdateOpen } = useUpdateStore()
  const isWindows = window.api.platform === 'win32'
  const updateStatus = snapshot?.status
  const hasUpdate = updateStatus?.state === 'available'
    || updateStatus?.state === 'downloading'
    || updateStatus?.state === 'downloaded'
    || (updateStatus?.state === 'error' && Boolean(updateStatus.version))

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="app-nodrag fixed inset-0 z-50 flex justify-end bg-canvas/35"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
        >
          <motion.aside
            initial={{ x: 36, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 36, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="app-nodrag flex h-full w-[390px] flex-col border-l border-line bg-surface-1 shadow-float"
            role="dialog" aria-modal="true" aria-label="应用设置"
          >
            <header className="flex h-16 items-center justify-between border-b border-line px-5">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent-soft text-accent"><Settings size={16} /></span>
                <div><h2 className="text-sm font-semibold text-ink-1">应用设置</h2><p className="text-[11px] text-ink-3">Lenza 偏好与存储</p></div>
              </div>
              <Button variant="ghost" size="sm" onClick={onClose} aria-label="关闭设置"><X size={15} /></Button>
            </header>

            <div className="flex-1 space-y-7 overflow-y-auto p-5">
              {loading && <p className="text-xs text-ink-3">正在加载设置…</p>}
              {error && <p className="rounded-lg bg-accent-soft px-3 py-2 text-xs text-danger">{error}</p>}
              {settings && (
                <>
                  <SettingSection title="外观" description="选择适合当前环境的界面主题。">
                    <Segmented options={THEME_OPTIONS} value={settings.theme} onChange={(theme) => void update({ theme })} className="w-full [&>button]:flex-1" />
                  </SettingSection>

                  <SettingSection title="录制保存位置" description="更改位置只影响之后的新录制，原有项目不会搬迁。">
                    <div className="rounded-xl border border-line bg-surface-2 p-3">
                      <p className="break-all font-mono text-[11px] leading-5 text-ink-2">{settings.recordingsPath}</p>
                      <div className="mt-3 flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => void chooseRecordingsPath()}>更改位置</Button>
                        <Button variant="ghost" size="sm" onClick={() => void openRecordingsPath()}><FolderOpen size={13} />打开文件夹</Button>
                      </div>
                    </div>
                  </SettingSection>

                  <SettingSection title="录像导出位置" description="导出完成后默认直接保存到这里，不覆盖同名文件。">
                    <div className="rounded-xl border border-line bg-surface-2 p-3">
                      <p className="break-all font-mono text-[11px] leading-5 text-ink-2">{settings.exportPath}</p>
                      <div className="mt-3 flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => void chooseExportPath()}>更改位置</Button>
                        <Button variant="ghost" size="sm" onClick={() => void openExportPath()}><FolderOpen size={13} />打开文件夹</Button>
                      </div>
                    </div>
                  </SettingSection>

                  <SettingSection title="回收站" description="到期录制会在 Lenza 运行期间自动永久清理。">
                    <div className="flex items-center justify-between gap-4 text-[13px] text-ink-2">
                      <span id="trash-retention-label">自动清理</span>
                      <Select value={settings.trashRetentionDays === null ? 'never' : String(settings.trashRetentionDays)} onValueChange={(value) => void update({ trashRetentionDays: value === 'never' ? null : Number(value) as 1 | 3 | 7 | 30 })}>
                        <SelectTrigger className="w-[132px]" aria-labelledby="trash-retention-label"><SelectValue /></SelectTrigger>
                        <SelectContent align="end">
                          {RETENTION_OPTIONS.map((option) => <SelectItem key={String(option.value)} value={option.value === null ? 'never' : String(option.value)}>{option.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </SettingSection>

                  {isWindows && (
                    <SettingSection title="关闭应用" description="后台运行时 Lenza 会保留在系统托盘。">
                      {settings.closeBehavior === null && <p className="mb-2 rounded-lg bg-surface-2 px-3 py-2 text-[11px] text-ink-3">尚未设置，关闭窗口时会先询问。</p>}
                      <Segmented options={CLOSE_OPTIONS} value={settings.closeBehavior ?? 'unset'} onChange={(closeBehavior) => void update({ closeBehavior: closeBehavior as 'background' | 'quit' })} className="w-full [&>button]:flex-1" />
                    </SettingSection>
                  )}

                  <SettingSection title="软件更新" description="启动后检查正式版本；发现更新时由你决定是否下载。">
                    <div className="rounded-xl border border-line bg-surface-2 p-3">
                      <div className="flex items-center justify-between gap-4">
                        <div><p className="text-[13px] font-medium text-ink-1">自动检查更新</p><p className="mt-0.5 text-[11px] text-ink-3">当前版本 v{snapshot?.currentVersion ?? '—'}</p></div>
                        <Switch checked={settings.autoCheckUpdates} onChange={(autoCheckUpdates) => void update({ autoCheckUpdates })} label="自动检查更新" />
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                        <p className={`flex items-center gap-1.5 text-[11px] ${hasUpdate ? 'font-medium text-accent' : 'text-ink-3'}`} aria-live="polite">
                          {hasUpdate && <ArrowUpCircle size={13} />}
                          {updateLabel(updateStatus)}
                        </p>
                        {hasUpdate && (
                          <Button variant="outline" size="sm" onClick={() => setUpdateOpen(true)}>
                            <ArrowUpCircle size={13} />查看更新
                          </Button>
                        )}
                        {!hasUpdate && (
                          <Button variant="outline" size="sm" disabled={updateStatus?.state === 'checking'} onClick={() => void check()}>
                            <RefreshCw size={13} className={updateStatus?.state === 'checking' ? 'animate-spin' : ''} />检查更新
                          </Button>
                        )}
                      </div>
                    </div>
                  </SettingSection>
                </>
              )}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function updateLabel(status: UpdateStatus | undefined): string {
  if (!status || status.state === 'idle') return '尚未检查'
  if (status.state === 'checking') return '正在检查…'
  if (status.state === 'not-available') return '已是最新版本'
  if (status.state === 'available') return `发现 v${status.version}`
  if (status.state === 'downloading') return `正在下载 ${Math.round(status.percent)}%`
  if (status.state === 'downloaded') return '更新已下载'
  return status.message
}

function SettingSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }): React.JSX.Element {
  return <section><h3 className="text-[13px] font-semibold text-ink-1">{title}</h3><p className="mb-3 mt-1 text-[11px] leading-5 text-ink-3">{description}</p>{children}</section>
}
