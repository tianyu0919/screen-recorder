import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { usePreviewStore } from '@/store/previewStore'
import { Switch } from '@/components/ui/switch'
import { ArrowRightIcon, AudioLinesIcon, CloseIcon, MicIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, '0')
  const s = (sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

/** 录制控制坞：开始/停止、麦克风开关、系统音频状态、上次录制入口、错误提示 */
export function RecordingPanel(): React.JSX.Element {
  const {
    status,
    recordingStartedAt,
    withMic,
    setWithMic,
    startRecording,
    stopRecording,
    selectedSourceId,
    error,
    clearError,
    inputHookDegraded,
    lastSession
  } = useAppStore()
  // 计时从 store 的 recordingStartedAt 推导：切换 tab 组件重挂载也不归零
  const [, forceTick] = useState(0)

  useEffect(() => {
    if (status !== 'recording') return
    const timer = setInterval(() => forceTick((n) => n + 1), 500)
    return () => clearInterval(timer)
  }, [status])

  const recording = status === 'recording'
  const elapsed =
    recording && recordingStartedAt !== null
      ? Math.max(0, Math.floor((Date.now() - recordingStartedAt) / 1000))
      : 0

  return (
    <div className="flex flex-none flex-col gap-2.5 px-6 pb-5 pt-1">
      {recording && inputHookDegraded && (
        <p className="rounded-lg bg-amber-950/50 px-3 py-2 text-xs text-amber-300">
          点击/键盘事件未采集，自动运镜不可用（macOS 需授予辅助功能权限后重启应用）。画面与鼠标轨迹仍正常录制。
        </p>
      )}

      {error && (
        <div className="flex items-start justify-between gap-2 rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300">
          <span>{error.message}</span>
          <button className="text-red-400 hover:text-red-200" onClick={clearError} aria-label="关闭">
            <CloseIcon size={13} />
          </button>
        </div>
      )}

      <div className="flex h-[92px] items-center gap-5 rounded-2xl border border-line bg-gradient-to-b from-surface-2 to-surface-1 px-5 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
        <div className="flex min-w-[176px] flex-col gap-2.5">
          <div className="flex items-center gap-2.5 text-[12.5px] text-ink-1">
            <Switch
              checked={withMic}
              onChange={setWithMic}
              disabled={status !== 'idle'}
              label="录制麦克风"
            />
            <MicIcon size={14} className="text-ink-2" />
            麦克风
          </div>
          <div className="flex items-center gap-2.5 text-[12.5px] text-ink-1">
            <Switch checked onChange={() => {}} disabled label="系统音频（自动采集）" />
            <AudioLinesIcon size={14} className="text-ink-2" />
            系统音频 <span className="text-[11px] text-ink-3">自动采集</span>
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center gap-1.5">
          {status === 'idle' ? (
            <>
              <button
                onClick={() => void startRecording()}
                disabled={!selectedSourceId}
                aria-label="开始录制"
                className={cn(
                  'grid h-[58px] w-[58px] place-items-center rounded-full border-[3px] transition-all',
                  selectedSourceId
                    ? 'border-[rgba(255,69,58,0.55)] bg-[rgba(255,69,58,0.08)] hover:bg-[rgba(255,69,58,0.16)]'
                    : 'border-line-strong bg-surface-2 opacity-50'
                )}
              >
                <span className="block h-[40px] w-[40px] rounded-full bg-[radial-gradient(circle_at_32%_28%,#ff7b6e,#e22d20_75%)] shadow-[0_4px_16px_rgba(255,69,58,0.45)]" />
              </button>
              <span className="text-[11.5px] text-ink-3">
                {selectedSourceId ? '开始录制' : '先选择屏幕或窗口'}
              </span>
            </>
          ) : (
            <>
              <button
                onClick={() => void stopRecording()}
                disabled={status === 'stopping'}
                aria-label="停止录制"
                className="grid h-[58px] w-[58px] place-items-center rounded-full border-[3px] border-[rgba(255,69,58,0.7)] bg-[rgba(255,69,58,0.12)]"
              >
                <span className="block h-[20px] w-[20px] rounded-[5px] bg-[#ff453a]" />
              </button>
              <span className="font-mono text-[12px] text-red-400">
                {status === 'stopping' ? '正在停止…' : formatElapsed(elapsed)}
              </span>
            </>
          )}
        </div>

        <div className="min-w-[176px]">
          {status === 'idle' && lastSession && (
            <button
              onClick={() => {
                useAppStore.getState().setView('preview')
                void usePreviewStore.getState().openSession(lastSession.sessionId)
              }}
              className="flex w-full items-center justify-between gap-3 rounded-[10px] border border-line bg-surface-1 px-3 py-2.5 text-left transition-colors hover:border-line-strong"
            >
              <div className="min-w-0">
                <div className="mb-0.5 text-xs text-ink-3">上次录制</div>
                <div className="truncate font-mono text-xs text-ink-1">{lastSession.sessionId}</div>
              </div>
              <span className="flex flex-none items-center gap-1 text-[12.5px] font-semibold text-accent">
                进入预览
                <ArrowRightIcon size={13} />
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
