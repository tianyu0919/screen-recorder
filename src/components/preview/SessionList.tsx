import { useEffect, useState } from 'react'
import type { RecordingSession } from '@shared/types'
import { formatDayLabel } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { RefreshIcon } from '@/components/icons'
import type { SessionAction } from './SessionCard'
import { SessionGrid } from './SessionGrid'
import { motion } from 'motion/react'
import { staggerContainer, staggerItem, viewTransition } from '@/lib/motion'
import { AnimatePresence } from 'motion/react'
import { LoaderCircle } from 'lucide-react'
import { Segmented } from '@/components/ui/segmented'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptySessionState } from './EmptySessionState'

interface SessionListProps {
  sessions: RecordingSession[]
  sessionsLoaded: boolean
  loading: boolean
  loadError: string | null
  onRefresh: () => void
  onOpen: (sessionId: string) => void | Promise<void>
  onSessionAction: (action: SessionAction, sessionId: string) => Promise<void>
  onEmptyTrash: () => Promise<void>
}

interface SessionGroup {
  label: string
  items: RecordingSession[]
}

const LIBRARY_TABS: Array<{ value: 'active' | 'trash'; label: string }> = [
  { value: 'active', label: '全部录制' },
  { value: 'trash', label: '回收站' }
]

/** 按最近编辑时间优先分组；从未编辑的会话使用录制时间。 */
function groupByDay(sessions: RecordingSession[]): SessionGroup[] {
  const groups: SessionGroup[] = []
  for (const s of sessions) {
    const label = formatDayLabel(s.editedAt ?? s.startedAt)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(s)
    else groups.push({ label, items: [s] })
  }
  return groups
}

/** 录制会话库：按日期分组的视频卡片网格，悬停卡片可无声预览 */
export function SessionList({
  sessions,
  sessionsLoaded,
  loading,
  loadError,
  onRefresh,
  onOpen,
  onSessionAction,
  onEmptyTrash
}: SessionListProps): React.JSX.Element {
  const [openingSessionId, setOpeningSessionId] = useState<string | null>(null)
  const [tab, setTab] = useState<'active' | 'trash'>('active')
  const [pending, setPending] = useState<{ action: SessionAction | 'empty'; sessionId?: string } | null>(null)
  const [acting, setActing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const visibleSessions = sessions.filter((session) => tab === 'trash' ? session.lifecycle === 'trashed' : session.lifecycle !== 'trashed')

  useEffect(() => {
    if (tab !== 'trash') return
    const timer = setInterval(onRefresh, 60_000)
    return () => clearInterval(timer)
  }, [tab, onRefresh])

  const handleOpen = async (sessionId: string): Promise<void> => {
    if (openingSessionId) return
    setOpeningSessionId(sessionId)
    try {
      await onOpen(sessionId)
    } finally {
      setOpeningSessionId(null)
    }
  }

  const confirmAction = async (): Promise<void> => {
    if (!pending) return
    setActing(true); setActionError(null)
    try {
      if (pending.action === 'empty') await onEmptyTrash()
      else await onSessionAction(pending.action, pending.sessionId!)
      const successText = pending.action === 'trash' ? '已移到回收站' : pending.action === 'restore' ? '录制已恢复' : pending.action === 'remove-missing' ? '失效记录已移除' : pending.action === 'empty' ? '回收站已清空' : '录制已永久删除'
      setFeedback(successText)
      setTimeout(() => setFeedback(null), 2200)
      setPending(null)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error))
    } finally { setActing(false) }
  }

  const confirmation = pending ? {
    title: pending.action === 'trash' ? '移到回收站？' : pending.action === 'restore' ? '恢复这段录制？' : pending.action === 'remove-missing' ? '移除失效记录？' : pending.action === 'empty' ? '清空回收站？' : '永久删除这段录制？',
    description: pending.action === 'trash' ? '录制会进入 Lenza 回收站，可在自动清理前恢复。' : pending.action === 'restore' ? '录制将恢复到原来的保存位置。' : pending.action === 'remove-missing' ? '这里只会移除 Lenza 中的失效索引，不会操作磁盘文件。' : '文件将被永久删除，且无法恢复。',
    label: pending.action === 'trash' ? '移到回收站' : pending.action === 'restore' ? '恢复' : pending.action === 'remove-missing' ? '移除记录' : '永久删除'
  } : null

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="enter" className="relative flex-1 overflow-y-auto px-6 pb-5 pt-0">
      <div className="flex flex-col gap-5">
        <motion.div variants={staggerItem} className="flex items-center justify-between">
          <div className="flex items-center gap-4"><h2 className="flex items-baseline gap-2 text-lg font-semibold tracking-[-0.02em] text-ink-1">
            录制会话
            {sessionsLoaded && visibleSessions.length > 0 && (
              <span className="font-mono text-[11px] font-normal text-ink-3">
                {visibleSessions.length}
              </span>
            )}
          </h2><Segmented options={LIBRARY_TABS} value={tab} onChange={(value) => setTab(value as 'active' | 'trash')} /></div>
          <div className="flex gap-2">{tab === 'trash' && visibleSessions.length > 0 && <Button variant="ghost" size="sm" onClick={() => setPending({ action: 'empty' })}>清空回收站</Button>}<Button variant="ghost" size="sm" onClick={onRefresh}>
            <RefreshIcon size={13} />
            刷新
          </Button></div>
        </motion.div>

        {loadError && (
          <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300">{loadError}</p>
        )}
        {actionError && <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-danger">{actionError}</p>}
        <AnimatePresence>
          {feedback && (
            <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} role="status" aria-live="polite" className="fixed right-6 top-20 z-[60] rounded-xl border border-line bg-surface-1 px-3.5 py-2.5 text-xs font-medium text-ink-1 shadow-float">
              {feedback}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            variants={viewTransition}
            initial="initial"
            animate="enter"
            exit="exit"
            className="flex flex-col gap-5"
          >
            {sessionsLoaded && visibleSessions.length === 0 && (
              <EmptySessionState kind={tab} onRefresh={onRefresh} />
            )}

            <AnimatePresence mode="popLayout">
              {groupByDay(visibleSessions).map((group) => (
                <motion.section exit={{ opacity: 0, height: 0, marginBottom: 0 }} key={`${tab}-${group.label}`} className="flex flex-col gap-2.5 pb-1">
                  <h3 className="text-[11px] font-semibold tracking-[0.4px] text-ink-3">{group.label}</h3>
                  <SessionGrid
                    sessions={group.items}
                    disabled={loading || openingSessionId !== null}
                    onOpen={(sessionId) => void handleOpen(sessionId)}
                    onAction={(action, session) => setPending({ action, sessionId: session.sessionId })}
                  />
                </motion.section>
              ))}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>

        {loading && !openingSessionId && <p className="text-xs text-ink-3">正在加载录制会话…</p>}
      </div>

      <AnimatePresence>
        {openingSessionId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 grid place-items-center bg-base/75 p-6 backdrop-blur-[2px]"
            role="status"
            aria-live="polite"
            aria-label="正在打开录制"
          >
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              className="flex min-w-[260px] items-center gap-3.5 rounded-2xl border border-line bg-surface-1 px-5 py-4 shadow-float"
            >
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                className="grid h-9 w-9 flex-none place-items-center rounded-full bg-accent-soft text-accent"
              >
                <LoaderCircle size={18} strokeWidth={2.2} />
              </motion.span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-ink-1">正在打开录制</p>
                <p className="mt-0.5 max-w-[210px] truncate font-mono text-[11px] text-ink-3">
                  {openingSessionId}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {confirmation && <ConfirmDialog open title={confirmation.title} description={confirmation.description} confirmLabel={confirmation.label} destructive={pending?.action === 'delete-permanent' || pending?.action === 'empty'} busy={acting} onCancel={() => { if (!acting) setPending(null) }} onConfirm={() => void confirmAction()} />}
    </motion.div>
  )
}
