import { useRef, useState } from 'react'
import type { RecordingSession } from '@shared/types'
import { formatDuration, formatTimeOfDay } from '@/lib/format'
import { MonitorIcon } from '@/components/icons'

interface SessionCardProps {
  session: RecordingSession
  disabled?: boolean
  onOpen: (sessionId: string) => void
}

/**
 * 会话卡片：视频首帧做缩略图，悬停无声播放预览（media:// 流式，Range 按需取）。
 * 视频缺失/解码失败时降级为占位图标，点击仍可进入（错误提示由加载路径给出）。
 */
export function SessionCard({ session, disabled, onOpen }: SessionCardProps): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [durationMs, setDurationMs] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)

  const startPreview = (): void => {
    void videoRef.current?.play().catch(() => {})
  }
  const stopPreview = (): void => {
    const v = videoRef.current
    if (!v) return
    v.pause()
    v.currentTime = Math.min(1, v.duration * 0.05)
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onOpen(session.sessionId)}
      onMouseEnter={startPreview}
      onMouseLeave={stopPreview}
      className="group flex flex-col gap-1.5 text-left disabled:opacity-50"
    >
      <div className="relative aspect-video overflow-hidden rounded-xl border border-line bg-surface-2 transition-colors group-hover:border-line-strong">
        {failed ? (
          <div className="grid h-full w-full place-items-center text-ink-3">
            <MonitorIcon size={22} />
          </div>
        ) : (
          <video
            ref={videoRef}
            src={`media://rec/${session.sessionId}/screen.webm`}
            muted
            playsInline
            preload="metadata"
            onLoadedMetadata={(e) => {
              const v = e.currentTarget
              if (Number.isFinite(v.duration)) {
                setDurationMs(v.duration * 1000)
                v.currentTime = Math.min(1, v.duration * 0.05)
              } else {
                // MediaRecorder 的 webm 头部无时长（duration=Infinity）：
                // seek 到极大值触发 Chromium 重算，结果由 onDurationChange 回收
                v.currentTime = 1e7
              }
            }}
            onDurationChange={(e) => {
              const v = e.currentTarget
              if (Number.isFinite(v.duration)) {
                setDurationMs(v.duration * 1000)
                v.currentTime = Math.min(1, v.duration * 0.05)
              }
            }}
            onError={() => setFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        )}
        {durationMs !== null && !failed && (
          <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[10.5px] text-white backdrop-blur-sm">
            {formatDuration(durationMs)}
          </span>
        )}
      </div>
      <span className="truncate px-0.5 font-mono text-[11px] text-ink-3 transition-colors group-hover:text-ink-2">
        {session.sessionId}
      </span>
      {session.editedAt && (
        <span className="px-0.5 text-[10.5px] text-ink-3">
          最近编辑 {formatTimeOfDay(session.editedAt)}
        </span>
      )}
    </button>
  )
}
