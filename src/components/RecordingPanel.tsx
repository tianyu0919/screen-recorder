import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { usePreviewStore } from '@/store/previewStore'
import { Button } from '@/components/ui/button'

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, '0')
  const s = (sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

/** 录制控制面板：开始/停止、麦克风开关、预览、状态与错误提示 */
export function RecordingPanel(): React.JSX.Element {
  const {
    status,
    withMic,
    setWithMic,
    startRecording,
    stopRecording,
    selectedSourceId,
    previewStream,
    error,
    clearError,
    inputHookDegraded,
    lastSession
  } = useAppStore()
  const [elapsed, setElapsed] = useState(0)
  const previewRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (previewRef.current) {
      previewRef.current.srcObject = previewStream
    }
  }, [previewStream])

  useEffect(() => {
    if (status !== 'recording') {
      setElapsed(0)
      return
    }
    const t0 = Date.now()
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 500)
    return () => clearInterval(timer)
  }, [status])

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-800 p-4">
      {previewStream && (
        <video
          ref={previewRef}
          autoPlay
          muted
          className="aspect-video w-full rounded bg-black object-contain"
        />
      )}
      <div className="flex items-center gap-3">
        {status === 'idle' ? (
          <Button onClick={() => void startRecording()} disabled={!selectedSourceId}>
            ● 开始录制
          </Button>
        ) : (
          <Button
            variant="destructive"
            onClick={() => void stopRecording()}
            disabled={status === 'stopping'}
          >
            ■ {status === 'stopping' ? '正在停止…' : '停止录制'}
          </Button>
        )}
        {status === 'recording' && (
          <span className="font-mono text-sm text-red-400">{formatElapsed(elapsed)}</span>
        )}
        <label className="ml-auto flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={withMic}
            disabled={status !== 'idle'}
            onChange={(e) => setWithMic(e.target.checked)}
          />
          录制麦克风
        </label>
      </div>

      {status === 'recording' && inputHookDegraded && (
        <p className="rounded bg-amber-950/50 px-3 py-2 text-xs text-amber-300">
          点击/键盘事件未采集，自动运镜不可用（macOS 需授予辅助功能权限后重启应用）。画面与鼠标轨迹仍正常录制。
        </p>
      )}

      {error && (
        <div className="flex items-start justify-between gap-2 rounded bg-red-950/50 px-3 py-2 text-sm text-red-300">
          <span>{error.message}</span>
          <button className="text-red-400 hover:text-red-200" onClick={clearError}>
            ✕
          </button>
        </div>
      )}

      {status === 'idle' && lastSession && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-zinc-500">
            上次录制已保存：<span className="font-mono">{lastSession.dir}</span>
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              useAppStore.getState().setView('preview')
              void usePreviewStore.getState().openSession(lastSession.sessionId)
            }}
          >
            进入预览 →
          </Button>
        </div>
      )}
    </div>
  )
}
