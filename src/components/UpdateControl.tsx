import { AnimatePresence, motion } from 'motion/react'
import { ArrowUpCircle, Download, ExternalLink, RefreshCw, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useUpdateStore } from '@/store/updateStore'

export function UpdateControl(): React.JSX.Element | null {
  const { snapshot, open, setOpen, download, install, openRelease } = useUpdateStore()
  const status = snapshot?.status
  const visible = status?.state === 'available' || status?.state === 'downloading' || status?.state === 'downloaded' || (status?.state === 'error' && Boolean(status.version))
  if (!visible || !snapshot) return null
  const version = status.state === 'available' || status.state === 'downloading' || status.state === 'downloaded' || status.state === 'error'
    ? status.version : ''

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.button
            type="button" aria-label={`发现新版本 ${version}`} onClick={() => setOpen(!open)}
            className="relative flex h-7 w-7 items-center justify-center rounded-md text-accent transition-colors hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            whileTap={{ scale: 0.94 }}
          >
            <ArrowUpCircle size={15} />
            <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent" />
          </motion.button>
        </TooltipTrigger>
        <TooltipContent>发现新版本 v{version}</TooltipContent>
      </Tooltip>
      <AnimatePresence>
        {open && (
          <motion.section
            role="dialog" aria-label="软件更新" initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="fixed right-24 top-12 z-[70] w-[330px] rounded-2xl border border-line bg-surface-1 p-4 shadow-float"
          >
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-[11px] font-medium text-accent">LENZA 更新</p><h2 className="mt-1 text-sm font-semibold text-ink-1">新版本 v{version} 已就绪</h2></div>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)} aria-label="关闭更新提示"><X size={14} /></Button>
            </div>
            {status.state === 'available' && status.releaseNotes && <p className="mt-3 line-clamp-4 text-xs leading-5 text-ink-3">{status.releaseNotes}</p>}
            {status.state === 'error' && <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-xs text-danger" role="alert">{status.message}</p>}
            {status.state === 'downloading' && (
              <div className="mt-4" aria-live="polite">
                <div className="mb-1.5 flex justify-between text-[11px] text-ink-3"><span>正在下载更新</span><span>{Math.round(status.percent)}%</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-3"><motion.div className="h-full rounded-full bg-accent" animate={{ width: `${status.percent}%` }} /></div>
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              {!snapshot.capabilities.canDownloadInApp && <Button onClick={() => void openRelease()}><ExternalLink size={14} />前往下载</Button>}
              {snapshot.capabilities.canDownloadInApp && status.state === 'available' && <Button onClick={() => void download()}><Download size={14} />立即下载</Button>}
              {snapshot.capabilities.canDownloadInApp && status.state === 'error' && status.operation === 'download' && <Button onClick={() => void download()}><Download size={14} />重试下载</Button>}
              {status.state === 'downloading' && <Button disabled><RefreshCw className="animate-spin" size={14} />下载中</Button>}
              {status.state === 'downloaded' && <Button disabled={snapshot.recording} onClick={() => void install()}><RotateCcw size={14} />重启并安装</Button>}
            </div>
            {snapshot.capabilities.reason === 'macos-unsigned' && <p className="mt-3 text-[11px] leading-4 text-ink-3">当前 macOS 版本未正式签名，请前往 GitHub Release 手动安装。</p>}
            {status.state === 'downloaded' && snapshot.recording && <p className="mt-3 text-[11px] text-ink-3">请结束当前录制后再安装更新。</p>}
          </motion.section>
        )}
      </AnimatePresence>
    </>
  )
}
