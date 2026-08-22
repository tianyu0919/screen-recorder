import { useEffect, useRef, useState } from 'react'
import type { RecordingSession } from '@shared/types'
import { formatDuration, formatTimeOfDay } from '@/lib/format'
import { MonitorIcon } from '@/components/icons'
import { motion } from 'motion/react'
import { staggerItem } from '@/lib/motion'
import { RotateCcw, Trash2, Unlink, X } from 'lucide-react'

export type SessionAction = 'trash' | 'restore' | 'delete-permanent' | 'remove-missing'

interface SessionCardProps {
  session: RecordingSession
  disabled?: boolean
  onOpen: (sessionId: string) => void
  onAction: (action: SessionAction, session: RecordingSession) => void
}

export function SessionCard({ session, disabled, onOpen, onAction }: SessionCardProps): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [durationMs, setDurationMs] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)
  const available = session.availability === undefined || session.availability === 'available'
  const trashed = session.lifecycle === 'trashed'
  const stopPreview = (): void => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
    previewTimerRef.current = null
    videoRef.current?.pause()
  }
  const startPreview = (): void => {
    if (!available) return
    previewTimerRef.current = setTimeout(() => void videoRef.current?.play().catch(() => {}), 160)
  }
  useEffect(() => () => { if (previewTimerRef.current) clearTimeout(previewTimerRef.current) }, [])
  return (
    <motion.article
      layout
      variants={staggerItem}
      exit={{ opacity: 0, scale: 0.96, y: -8, transition: { duration: 0.18, ease: 'easeOut' } }}
      whileHover={{ y: -4 }}
      onMouseEnter={startPreview}
      onMouseLeave={stopPreview}
      className="group relative flex flex-col gap-1.5 rounded-2xl border border-transparent bg-surface-1 p-2.5 shadow-card transition-colors hover:border-line-strong focus-within:border-line-strong"
    >
      <button type="button" disabled={disabled || !available || trashed} onClick={() => onOpen(session.sessionId)} className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default">
        <div className="relative aspect-video overflow-hidden rounded-xl border border-line bg-surface-2">
          {!available || failed ? <div className="grid h-full place-items-center text-ink-3"><MonitorIcon size={22} /></div> : (
            <video ref={videoRef} src={`media://rec/${session.sessionId}/screen.webm`} muted playsInline preload="metadata"
              onLoadedMetadata={(event) => { const video = event.currentTarget; if (Number.isFinite(video.duration)) { setDurationMs(video.duration * 1000); video.currentTime = Math.min(1, video.duration * 0.05) } else video.currentTime = 1e7 }}
              onDurationChange={(event) => { const video = event.currentTarget; if (Number.isFinite(video.duration)) { setDurationMs(video.duration * 1000); video.currentTime = Math.min(1, video.duration * 0.05) } }}
              onError={() => setFailed(true)} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.015]" />
          )}
          {durationMs !== null && available && <span className="absolute bottom-2 right-2 rounded-md bg-canvas/80 px-1.5 py-0.5 font-mono text-[10.5px] text-on-accent">{formatDuration(durationMs)}</span>}
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2 px-0.5">
          <span className="truncate font-mono text-[11px] text-ink-3">{session.sessionId}</span>
          {!trashed && available && <span className="text-[11px] font-semibold text-accent opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">进入预览</span>}
        </div>
      </button>
      <div className="min-h-[24px] pr-9"><SessionStatus session={session} /></div>
      <SessionActions session={session} onAction={(action) => onAction(action, session)} />
    </motion.article>
  )
}

function SessionActions({ session, onAction }: { session: RecordingSession; onAction: (action: SessionAction) => void }): React.JSX.Element {
  if (session.availability === 'storage-unavailable') return <></>
  const actions: Array<{ action: SessionAction; label: string; Icon: typeof Trash2 }> = session.lifecycle === 'trashed'
    ? [{ action: 'restore', label: '恢复录制', Icon: RotateCcw }, { action: 'delete-permanent', label: '永久删除', Icon: Trash2 }]
    : session.availability === 'source-missing'
      ? [{ action: 'remove-missing', label: '移除失效记录', Icon: X }]
      : [{ action: 'trash', label: '移到回收站', Icon: Trash2 }]
  return <div className="absolute bottom-2.5 right-2.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">{actions.map(({ action, label, Icon }) => <button key={action} type="button" aria-label={label} title={label} onClick={() => onAction(action)} className="grid h-7 w-7 place-items-center rounded-lg border border-line bg-surface-2 text-ink-2 hover:border-accent-border hover:bg-accent-soft hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><Icon size={13} /></button>)}</div>
}

function SessionStatus({ session }: { session: RecordingSession }): React.JSX.Element {
  if (session.availability === 'storage-unavailable') return <span className="flex items-center gap-1 px-0.5 text-[10.5px] text-warning"><Unlink size={11} />存储位置不可用</span>
  if (session.availability === 'source-missing') return <span className="flex items-center gap-1 px-0.5 text-[10.5px] text-danger"><Unlink size={11} />源文件已被移除</span>
  if (session.cleanupFailed) return <span className="px-0.5 text-[10.5px] text-danger">清理失败，可重试</span>
  if (session.lifecycle === 'trashed') return <TrashCountdown purgeAt={session.purgeAt} />
  return session.editedAt ? <span className="px-0.5 text-[10.5px] text-ink-3">最近编辑 {formatTimeOfDay(session.editedAt)}</span> : <span className="h-[16px]" />
}

function TrashCountdown({ purgeAt }: { purgeAt?: number }): React.JSX.Element {
  const [, tick] = useState(0)
  useEffect(() => { const timer = setInterval(() => tick((value) => value + 1), 1000); return () => clearInterval(timer) }, [])
  if (purgeAt === undefined) return <span className="px-0.5 text-[10.5px] text-ink-3">永久保留</span>
  const seconds = Math.max(0, Math.ceil((purgeAt - Date.now()) / 1000))
  const days = Math.floor(seconds / 86400), hours = Math.floor(seconds % 86400 / 3600), minutes = Math.floor(seconds % 3600 / 60)
  const text = days > 0 ? `${days} 天 ${hours} 小时` : hours > 0 ? `${hours} 小时 ${minutes} 分钟` : `${minutes} 分 ${seconds % 60} 秒`
  return <span className="px-0.5 text-[10.5px] text-warning">距离删除还剩 {text}</span>
}
