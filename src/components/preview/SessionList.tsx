import type { RecordingSession } from '@shared/types'
import { formatDayLabel } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { RefreshIcon } from '@/components/icons'
import { SessionCard } from './SessionCard'

interface SessionListProps {
  sessions: RecordingSession[]
  sessionsLoaded: boolean
  loading: boolean
  loadError: string | null
  onRefresh: () => void
  onOpen: (sessionId: string) => void
}

interface SessionGroup {
  label: string
  items: RecordingSession[]
}

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
  onOpen
}: SessionListProps): React.JSX.Element {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-baseline gap-2 text-[13px] font-semibold text-ink-2">
            录制会话
            {sessionsLoaded && sessions.length > 0 && (
              <span className="font-mono text-[11px] font-normal text-ink-3">
                {sessions.length}
              </span>
            )}
          </h2>
          <Button variant="ghost" size="sm" onClick={onRefresh}>
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
            <p className="text-xs text-ink-3">切到「录制」页，录下第一段吧</p>
          </div>
        )}

        {groupByDay(sessions).map((group) => (
          <section key={group.label} className="flex flex-col gap-2.5">
            <h3 className="text-[11px] font-semibold tracking-[0.4px] text-ink-3">
              {group.label}
            </h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {group.items.map((s) => (
                <SessionCard
                  key={s.sessionId}
                  session={s}
                  disabled={loading}
                  onOpen={onOpen}
                />
              ))}
            </div>
          </section>
        ))}

        {loading && <p className="text-xs text-ink-3">加载中…</p>}
      </div>
    </div>
  )
}
