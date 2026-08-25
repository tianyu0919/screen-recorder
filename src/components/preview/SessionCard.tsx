import { useEffect, useRef, useState } from 'react'
import type { RecordingSession } from '@shared/types'
import type { SessionThumbnailInfo } from '@shared/sessionThumbnail'
import { formatDuration, formatTimeOfDay } from '@/lib/format'
import { MonitorIcon } from '@/components/icons'
import { motion } from 'motion/react'
import { staggerItem } from '@/lib/motion'
import { Loader2, RotateCcw, Trash2, Unlink, X } from 'lucide-react'

export type SessionAction = 'trash' | 'restore' | 'delete-permanent' | 'remove-missing'

interface SessionCardProps {
  session: RecordingSession
  disabled?: boolean
  onOpen: (sessionId: string) => void
  onAction: (action: SessionAction, session: RecordingSession) => void
  onThumbnailReady(thumbnail: SessionThumbnailInfo): void
}

export function SessionCard({ session, disabled, onOpen, onAction, onThumbnailReady }: SessionCardProps): React.JSX.Element {
  const articleRef = useRef<HTMLElement>(null)
  const probeRef = useRef<HTMLVideoElement>(null)
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blobUrlRef = useRef<string | null>(null)
  const generatingRef = useRef(false)
  const cancelledRef = useRef(false)
  const [nearViewport, setNearViewport] = useState(false)
  const [thumbnail, setThumbnail] = useState<SessionThumbnailInfo | undefined>(session.thumbnail)
  const [durationMs, setDurationMs] = useState<number | null>(session.thumbnail?.durationMs ?? null)
  const [imageReady, setImageReady] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewReady, setPreviewReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const available = session.availability === undefined || session.availability === 'available'
  const trashed = session.lifecycle === 'trashed'

  useEffect(() => {
    if (!session.thumbnail) return
    setImageReady(false)
    setThumbnail(session.thumbnail)
    setDurationMs(session.thumbnail.durationMs)
    setFailed(false)
  }, [session.thumbnail])

  useEffect(() => {
    const element = articleRef.current
    if (!element || !available || thumbnail) return
    const observer = new IntersectionObserver(([entry]) => setNearViewport(entry.isIntersecting), {
      rootMargin: '75% 0px'
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [available, thumbnail])

  useEffect(() => {
    cancelledRef.current = false
    return () => {
      cancelledRef.current = true
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    }
  }, [])

  const startPreview = (): void => {
    if (!available || !thumbnail || !imageReady) return
    previewTimerRef.current = setTimeout(() => setShowPreview(true), 160)
  }
  const stopPreview = (): void => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
    previewTimerRef.current = null
    setShowPreview(false)
    setPreviewReady(false)
  }

  const prepareProbe = (video: HTMLVideoElement): void => {
    if (Number.isFinite(video.duration) && video.duration > 0) {
      setDurationMs(video.duration * 1000)
      video.currentTime = Math.min(1, video.duration * 0.05)
    } else video.currentTime = 1e7
  }

  const captureProbe = async (): Promise<void> => {
    const video = probeRef.current
    if (!video || generatingRef.current || video.videoWidth <= 0 || video.videoHeight <= 0) return
    generatingRef.current = true
    try {
      const measuredDurationMs = Number.isFinite(video.duration) && video.duration > 0
        ? video.duration * 1000
        : durationMs
      setDurationMs(measuredDurationMs)
      const blob = await videoFrameToWebp(video)
      if (cancelledRef.current) return
      const localUrl = URL.createObjectURL(blob)
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = localUrl
      const local = { url: localUrl, durationMs: measuredDurationMs }
      setImageReady(false)
      setThumbnail(local)
      try {
        const saved = await window.api.saveSessionThumbnail({
          sessionId: session.sessionId,
          webp: await blob.arrayBuffer(),
          durationMs: measuredDurationMs
        })
        if (cancelledRef.current) return
        URL.revokeObjectURL(localUrl)
        if (blobUrlRef.current === localUrl) blobUrlRef.current = null
        setImageReady(false)
        setThumbnail(saved)
        onThumbnailReady(saved)
      } catch { /* 内存缩略图继续可用，下次进入会重试持久化。 */ }
    } catch { if (!cancelledRef.current) setFailed(true) }
  }

  return (
    <motion.article ref={articleRef} variants={staggerItem}
      exit={{ opacity: 0, scale: 0.96, y: -8, transition: { duration: 0.18, ease: 'easeOut' } }}
      whileHover={{ y: -4 }} onMouseEnter={startPreview} onMouseLeave={stopPreview}
      className="group relative flex flex-col gap-1.5 rounded-2xl border border-transparent bg-surface-1 p-2.5 shadow-card transition-colors hover:border-line-strong focus-within:border-line-strong">
      <button type="button" disabled={disabled || !available || trashed} onClick={() => onOpen(session.sessionId)}
        className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default">
        <div className="relative aspect-video overflow-hidden rounded-xl border border-line bg-surface-2">
          {!available || failed ? <ThumbnailFallback /> : thumbnail ? <>
            {!imageReady && <ThumbnailLoading label="正在加载封面" />}
            <img src={thumbnail.url} alt="" draggable={false} loading="lazy"
              onLoad={() => setImageReady(true)}
              onError={() => { setImageReady(false); setThumbnail(undefined); setNearViewport(true) }}
              className={`absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-200 group-hover:scale-[1.015] ${imageReady ? 'opacity-100' : 'opacity-0'}`} />
          </> : nearViewport ? <>
            <ThumbnailLoading label="正在生成封面" />
            <video ref={probeRef} src={`media://rec/${session.sessionId}/screen.webm`} muted playsInline preload="metadata"
              onLoadedMetadata={(event) => prepareProbe(event.currentTarget)}
              onDurationChange={(event) => prepareProbe(event.currentTarget)}
              onSeeked={() => void captureProbe()} onError={() => setFailed(true)}
              aria-hidden="true" className="pointer-events-none absolute h-px w-px opacity-0" />
          </> : <ThumbnailFallback />}
          {showPreview && (
            <>
              {!previewReady && <ThumbnailLoading label="正在加载预览" overlay />}
              <video src={`media://rec/${session.sessionId}/screen.webm`} muted playsInline autoPlay preload="auto"
              onCanPlay={() => setPreviewReady(true)} onError={stopPreview}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-150 ${previewReady ? 'opacity-100' : 'opacity-0'}`} />
            </>
          )}
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2 px-0.5">
          <span title={session.displayName ?? session.sessionId}
            className={`min-w-0 truncate text-[11px] text-ink-3 ${session.displayName ? 'font-medium' : 'font-mono'}`}>
            {session.displayName ?? session.sessionId}
          </span>
          {durationMs !== null && available && (
            <span className="flex-none rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] font-semibold leading-none text-ink-2">
              {formatDuration(durationMs)}
            </span>
          )}
        </div>
      </button>
      <div className="min-h-[24px] pr-9"><SessionStatus session={session} /></div>
      <SessionActions session={session} onAction={(action) => onAction(action, session)} />
    </motion.article>
  )
}

function ThumbnailFallback(): React.JSX.Element {
  return <div className="grid h-full place-items-center text-ink-3"><MonitorIcon size={22} /></div>
}

function ThumbnailLoading({ label, overlay = false }: { label: string; overlay?: boolean }): React.JSX.Element {
  return (
    <div role="status" aria-label={label}
      className={`absolute inset-0 z-10 grid place-items-center overflow-hidden ${overlay ? 'bg-surface-1/35 backdrop-blur-[1px]' : 'bg-surface-2'}`}>
      {!overlay && <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-surface-2 via-surface-3 to-surface-2" />}
      <div className="relative flex items-center gap-1.5 rounded-full border border-line bg-surface-1/90 px-2.5 py-1 text-[10.5px] text-ink-3 shadow-sm">
        <Loader2 aria-hidden="true" size={12} className="animate-spin text-accent" />
        <span>{label}</span>
      </div>
    </div>
  )
}

async function videoFrameToWebp(video: HTMLVideoElement): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = 320; canvas.height = 180
  const context = canvas.getContext('2d')
  if (!context) throw new Error('无法创建缩略图画布')
  const sourceRatio = video.videoWidth / video.videoHeight, targetRatio = canvas.width / canvas.height
  let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight
  if (sourceRatio > targetRatio) { sw = sh * targetRatio; sx = (video.videoWidth - sw) / 2 }
  else { sh = sw / targetRatio; sy = (video.videoHeight - sh) / 2 }
  context.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.78))
  if (!blob) throw new Error('无法编码 WebP 缩略图')
  return blob
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
