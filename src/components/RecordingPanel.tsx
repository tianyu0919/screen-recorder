import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { usePreviewStore } from '@/store/previewStore'
import { Switch } from '@/components/ui/switch'
import { AudioLinesIcon, CloseIcon, MicIcon } from '@/components/icons'
import { cn } from '@/lib/utils'
import { motion, useReducedMotion } from 'motion/react'
import { Play, Video } from 'lucide-react'

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, '0')
  const s = (sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

/** 录制控制坞：开始/停止、麦克风开关、系统音频状态、上次录制入口、错误提示 */
export function RecordingPanel(): React.JSX.Element {
  const reduceMotion = useReducedMotion()
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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-none flex-col gap-2.5 border-t border-line bg-surface-1 px-6 py-4"
    >
      {recording && inputHookDegraded && (
        <p className="w-full rounded-xl bg-amber-950/50 px-3 py-2 text-xs text-amber-300 shadow-card">
          点击/键盘事件未采集，自动运镜不可用（macOS 需授予辅助功能权限后重启应用）。画面与鼠标轨迹仍正常录制。
        </p>
      )}

      {error && (
        <div className="flex w-full items-start justify-between gap-2 rounded-xl bg-red-950/50 px-3 py-2 text-sm text-red-300 shadow-card">
          <span>{error.message}</span>
          <button className="text-red-400 hover:text-red-200" onClick={clearError} aria-label="关闭">
            <CloseIcon size={13} />
          </button>
        </div>
      )}

      <div className="grid h-[82px] w-full grid-cols-[minmax(0,1fr)_96px_minmax(0,1fr)] items-center bg-surface-1 px-1">
        <div className="flex min-w-[210px] flex-col gap-2">
          <div className="flex items-center gap-2.5 text-[12.5px] text-ink-1">
            <Switch
              checked={withMic}
              onChange={setWithMic}
              disabled={status !== 'idle'}
              label="录制麦克风"
            />
            <MicIcon size={14} className="text-ink-2" />
            <span className="whitespace-nowrap">麦克风</span>
          </div>
          <div className="flex items-center gap-2.5 text-[12.5px] text-ink-1">
            <Switch checked onChange={() => {}} disabled label="系统音频（自动采集）" />
            <AudioLinesIcon size={14} className="text-ink-2" />
            <span className="whitespace-nowrap">系统音频</span>
            <span className="whitespace-nowrap text-[11px] text-ink-3">自动采集</span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1 justify-self-center">
          {status === 'idle' ? (
            <>
              <motion.button
                onClick={() => void startRecording()}
                disabled={!selectedSourceId}
                aria-label="开始录制"
                whileHover={selectedSourceId ? { scale: 1.045 } : undefined}
                whileTap={selectedSourceId ? { scale: 0.93 } : undefined}
                className={cn(
                  'group/record relative grid h-[58px] w-[58px] place-items-center rounded-full border bg-surface-1 shadow-card transition-[border-color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-base',
                  selectedSourceId
                    ? 'cursor-pointer border-accent-border hover:border-accent hover:bg-accent-soft hover:shadow-[0_10px_28px_rgba(240,82,45,0.18)]'
                    : 'cursor-not-allowed border-line-strong opacity-55'
                )}
              >
                {selectedSourceId && !reduceMotion && (
                  <motion.span
                    aria-hidden
                    className="absolute inset-[5px] rounded-full bg-accent-soft"
                    animate={{ scale: [0.96, 1.12], opacity: [0.5, 0] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut', repeatDelay: 0.25 }}
                  />
                )}
                <span className={cn('absolute inset-[7px] rounded-full border-2 transition-[border-color,transform] duration-200', selectedSourceId ? 'border-accent-border group-hover/record:scale-[0.94]' : 'border-line-strong')} />
                <span aria-hidden className={cn('relative block h-[28px] w-[28px] rounded-full transition-[transform,box-shadow,background-color] duration-200', selectedSourceId ? 'bg-accent shadow-[0_6px_16px_rgba(240,82,45,0.34)] group-hover/record:scale-110' : 'bg-surface-3')} />
              </motion.button>
              <span className={cn('text-[11.5px]', selectedSourceId ? 'font-medium text-ink-2' : 'text-ink-3')}>
                {selectedSourceId ? '开始录制' : '先选择屏幕或窗口'}
              </span>
            </>
          ) : (
            <>
              <motion.button
                onClick={() => void stopRecording()}
                disabled={status === 'stopping'}
                aria-label="停止录制"
                whileHover={status !== 'stopping' ? { scale: 1.04 } : undefined}
                whileTap={{ scale: 0.94 }}
                className="relative grid h-[60px] w-[60px] place-items-center rounded-full text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-base disabled:opacity-60"
              >
                {!reduceMotion && status !== 'stopping' && <motion.span aria-hidden className="absolute inset-0 rounded-full border-2 border-accent" animate={{ scale: [0.92, 1.12], opacity: [0.55, 0] }} transition={{ duration: 1.35, repeat: Infinity, ease: 'easeOut' }} />}
                <span className="absolute inset-[5px] rounded-full border border-accent-border bg-accent-soft shadow-[0_8px_24px_rgba(240,82,45,0.22)]" />
                <motion.span
                  aria-hidden
                  animate={status === 'stopping' && !reduceMotion ? { rotate: 360 } : { rotate: 0 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  className={cn('relative block h-[22px] w-[22px] bg-accent shadow-[0_5px_14px_rgba(240,82,45,0.38)]', status === 'stopping' ? 'rounded-[7px] border-2 border-dashed border-on-accent bg-transparent' : 'rounded-[6px]')}
                />
              </motion.button>
              <span className="font-mono text-[12px] text-red-400">
                {status === 'stopping' ? '正在停止…' : formatElapsed(elapsed)}
              </span>
            </>
          )}
        </div>

        <div className="w-full max-w-[330px] justify-self-end">
          {status === 'idle' && lastSession && (
            <div className="flex h-[58px] items-center gap-3 border-l border-line pl-5">
              <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-accent-soft text-accent">
                <Video size={16} strokeWidth={1.8} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="mb-1 text-[10.5px] font-medium tracking-[0.2px] text-ink-3">上次录制</div>
                <div className="truncate font-mono text-[11px] text-ink-2">{lastSession.sessionId}</div>
              </div>
              <motion.button
                type="button"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  useAppStore.getState().setView('preview')
                  void usePreviewStore.getState().openSession(lastSession.sessionId)
                }}
                className="flex h-8 flex-none items-center gap-1.5 rounded-lg border border-accent-border bg-accent-soft px-3 text-[12px] font-semibold text-accent transition-colors hover:bg-accent hover:text-on-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
              >
                <Play size={12} fill="currentColor" />
                打开预览
              </motion.button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
