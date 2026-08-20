import { useEffect } from 'react'
import { usePreviewStore } from '@/store/previewStore'
import { Button } from '@/components/ui/button'
import { PreviewPlayer } from './PreviewPlayer'
import { MotionParamsPanel } from './MotionParamsPanel'
import { ExportControls } from './ExportControls'

function formatSessionTime(startedAt: number): string {
  return new Date(startedAt).toLocaleString()
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
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-200">
            预览 <span className="font-mono text-zinc-400">{current.session.sessionId}</span>
          </h2>
          <div className="flex items-center gap-2">
            <ExportControls />
            <Button
              variant="outline"
              size="sm"
              onClick={() => void window.api.revealSession(current.session.sessionId)}
            >
              打开文件位置
            </Button>
            <Button variant="ghost" size="sm" onClick={closeSession}>
              ← 返回会话列表
            </Button>
          </div>
        </div>
        <PreviewPlayer
          timeline={current.timeline}
          videoUrl={current.videoUrl}
          audioUrl={current.audioUrl}
          systemAudioUrl={current.systemAudioUrl}
          systemAudioOffsetSec={current.systemAudioOffsetSec}
          keyframes={keyframes}
          ripples={ripples}
        />
        <MotionParamsPanel />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-800 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-200">录制会话</h2>
        <Button variant="ghost" size="sm" onClick={() => void loadSessions()}>
          刷新
        </Button>
      </div>

      {loadError && (
        <p className="rounded bg-red-950/50 px-3 py-2 text-sm text-red-300">{loadError}</p>
      )}

      {sessionsLoaded && sessions.length === 0 && (
        <p className="text-sm text-zinc-500">还没有录制会话，先去「录制」页录一段吧。</p>
      )}

      <ul className="flex flex-col gap-2">
        {sessions.map((s) => (
          <li key={s.sessionId}>
            <button
              onClick={() => void openSession(s.sessionId)}
              disabled={loading}
              className="flex w-full items-center justify-between rounded-md border border-zinc-800 px-3 py-2 text-left text-sm hover:bg-zinc-800/60 disabled:opacity-50"
            >
              <span className="font-mono text-zinc-300">{s.sessionId}</span>
              <span className="text-xs text-zinc-500">{formatSessionTime(s.startedAt)}</span>
            </button>
          </li>
        ))}
      </ul>

      {loading && <p className="text-xs text-zinc-500">加载中…</p>}
    </div>
  )
}
