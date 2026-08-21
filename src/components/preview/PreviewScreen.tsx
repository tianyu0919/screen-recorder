import { useEffect } from 'react'
import { usePreviewStore } from '@/store/previewStore'
import { Button } from '@/components/ui/button'
import { PreviewPlayer } from './PreviewPlayer'
import { MotionParamsPanel } from './MotionParamsPanel'
import { CutsPanel } from './CutsPanel'
import { ExportControls } from './ExportControls'
import { Chip } from '@/components/ui/chip'
import { ArrowRightIcon, ChevronLeftIcon, FolderIcon, RefreshIcon } from '@/components/icons'

function formatSessionTime(startedAt: number): string {
  return new Date(startedAt).toLocaleString()
}

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000)
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, '0')
  const s = (total % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

/**
 * 预览界面（Task 3.3）：会话列表 → 选中加载 → 播放器 + 运镜参数面板。
 * events.json 损坏/不兼容时显示友好错误且不进入预览（current 保持 null）。
 */
export function PreviewScreen(): React.JSX.Element {
  const {
    sessions,
    sessionsLoaded,
    loading,
    loadError,
    current,
    keyframes,
    ripples,
    loadSessions,
    openSession,
    closeSession
  } = usePreviewStore()

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  if (current) {
    const { timeline } = current
    const infoRows: Array<[string, string]> = [
      ['时长', formatDuration(timeline.durationMs)],
      ['分辨率', `${timeline.canvas.width} x ${timeline.canvas.height}`],
      ['帧率', `${timeline.events.video.fps}fps`],
      ['点击事件', `${timeline.events.clicks.length} 次`],
      ['键盘事件', `${timeline.events.keys.length} 次`],
      ['麦克风轨', current.audioUrl ? '有' : '无'],
      ['系统音频轨', current.systemAudioUrl ? '有' : '无']
    ]
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {/* 工具栏：会话标识 + 导出操作 */}
        <div className="flex h-[52px] flex-none items-center justify-between border-b border-line px-4">
          <div className="flex items-center gap-2.5">
            <Button variant="ghost" size="sm" onClick={closeSession} aria-label="返回会话列表">
              <ChevronLeftIcon size={15} />
            </Button>
            <span className="font-mono text-[13px] text-ink-1">{current.session.sessionId}</span>
            <Chip>{formatDuration(timeline.durationMs)}</Chip>
            <Chip>
              {timeline.canvas.width} x {timeline.canvas.height} · {timeline.events.video.fps}fps
            </Chip>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => void window.api.revealSession(current.session.sessionId)}
            >
              <FolderIcon size={14} />
              打开文件位置
            </Button>
            <ExportControls />
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <PreviewPlayer
            timeline={timeline}
            videoUrl={current.videoUrl}
            audioUrl={current.audioUrl}
            systemAudioUrl={current.systemAudioUrl}
            systemAudioOffsetSec={current.systemAudioOffsetSec}
            keyframes={keyframes}
            ripples={ripples}
          />

          {/* 检查器 */}
          <aside className="flex min-h-0 w-[280px] flex-none flex-col overflow-y-auto border-l border-line bg-surface-1">
            <div className="flex h-[38px] flex-none items-center border-b border-line px-4 text-[12.5px] font-semibold text-ink-2">
              检查器
            </div>
            <MotionParamsPanel />
            <CutsPanel />
            <section className="px-4 py-3.5">
              <h3 className="mb-2.5 text-[11px] font-semibold tracking-[0.4px] text-ink-3">
                会话信息
              </h3>
              <dl className="flex flex-col gap-1.5">
                {infoRows.map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between text-[12.5px]">
                    <dt className="text-ink-3">{label}</dt>
                    <dd className="font-mono text-[11.5px] text-ink-1">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </aside>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      <div className="mx-auto flex max-w-2xl flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-ink-2">录制会话</h2>
          <Button variant="ghost" size="sm" onClick={() => void loadSessions()}>
            <RefreshIcon size={13} />
            刷新
          </Button>
        </div>

        {loadError && (
          <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300">{loadError}</p>
        )}

        {sessionsLoaded && sessions.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-line py-14">
            <p className="text-sm text-ink-3">还没有录制会话</p>
            <p className="text-xs text-ink-3">先去「录制」页录一段吧</p>
          </div>
        )}

        <ul className="flex flex-col gap-2">
          {sessions.map((s) => (
            <li key={s.sessionId}>
              <button
                onClick={() => void openSession(s.sessionId)}
                disabled={loading}
                className="group flex w-full items-center justify-between rounded-xl border border-line bg-surface-1 px-4 py-3 text-left transition-colors hover:border-line-strong disabled:opacity-50"
              >
                <span className="font-mono text-[13px] text-ink-1">{s.sessionId}</span>
                <span className="flex items-center gap-2 text-xs text-ink-3">
                  {formatSessionTime(s.startedAt)}
                  <ArrowRightIcon
                    size={13}
                    className="text-ink-3 transition-colors group-hover:text-accent"
                  />
                </span>
              </button>
            </li>
          ))}
        </ul>

        {loading && <p className="text-xs text-ink-3">加载中…</p>}
      </div>
    </div>
  )
}
