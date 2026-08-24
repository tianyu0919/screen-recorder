import { useEffect, useState } from 'react'
import { usePreviewStore } from '@/store/previewStore'
import { formatDayLabel, formatDuration, formatTimeOfDay } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { PreviewPlayer } from './PreviewPlayer'
import { MotionParamsPanel } from './MotionParamsPanel'
import { AudioPanel } from './AudioPanel'
import { BackgroundPanel } from './BackgroundPanel'
import { CutsPanel } from './CutsPanel'
import { ExportControls } from './ExportControls'
import { SessionList } from './SessionList'
import { Chip } from '@/components/ui/chip'
import { ChevronLeftIcon, FolderIcon } from '@/components/icons'
import { PreviewLayoutControls } from './PreviewLayoutControls'
import type { PreviewScaleMode } from '@/lib/stageFit'
import { EditSaveStatus } from './EditSaveStatus'
import { AnimatePresence, motion, type Variants } from 'motion/react'
import { blocksGlobalShortcut } from '@/lib/keyboardTarget'
import { useSettingsStore } from '@/store/settingsStore'
import { usePreviewPerformanceToast } from './usePreviewPerformanceToast'

interface PreviewScreenProps {
  focusMode: boolean
  onFocusModeChange(active: boolean): void
}

const detailEntrance: Variants = {
  initial: { opacity: 0 },
  enter: {
    opacity: 1,
    transition: { duration: 0.18, staggerChildren: 0.07, delayChildren: 0.03 }
  }
}

const detailSectionEntrance: Variants = {
  initial: { opacity: 0, y: 10 },
  enter: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] }
  }
}

/**
 * 预览界面（Task 3.3）：会话列表 → 选中加载 → 播放器 + 运镜参数面板。
 * events.json 损坏/不兼容时显示友好错误且不进入预览（current 保持 null）。
 */
export function PreviewScreen({
  focusMode,
  onFocusModeChange
}: PreviewScreenProps): React.JSX.Element {
  const [scaleMode, setScaleMode] = useState<PreviewScaleMode>('fit')
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const previewQuality = useSettingsStore((state) => state.settings?.previewQuality ?? 'auto')
  const updateSettings = useSettingsStore((state) => state.update)
  const {
    sessions,
    sessionsLoaded,
    loading,
    loadError,
    current,
    keyframes,
    ripples,
    keyPrompts,
    sourceDurationMs,
    saveState,
    retrySave,
    editLoadError,
    loadSessions,
    openSession,
    closeSession,
    trashSession,
    restoreSession,
    deleteSessionPermanent,
    emptyTrash,
    removeMissingSession
  } = usePreviewStore()
  const notifyPerformanceIssue = usePreviewPerformanceToast(current?.session.sessionId ?? null)

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  useEffect(() => {
    setScaleMode('fit')
    setInspectorOpen(true)
    onFocusModeChange(false)
  }, [current?.session.sessionId])

  useEffect(() => {
    if (!current) return
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.repeat) return
      if (focusMode && event.key === 'Escape') {
        event.preventDefault()
        onFocusModeChange(false)
        return
      }
      if (blocksGlobalShortcut(event.target)) return
      const key = event.key.toLowerCase()
      if (key === 'f') {
        event.preventDefault()
        onFocusModeChange(!focusMode)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [current, focusMode, onFocusModeChange])

  if (current) {
    const { timeline } = current
    const durationMs = sourceDurationMs ?? timeline.durationMs
    const effectiveClickCount = ripples.filter((ripple) => ripple.t >= 0 && ripple.t <= durationMs).length
    const effectiveKeyCount = keyPrompts.filter((prompt) => prompt.t >= 0 && prompt.t <= durationMs).length
    const infoRows: Array<[string, string]> = [
      ['时长', formatDuration(durationMs)],
      ['分辨率', `${timeline.canvas.width} x ${timeline.canvas.height}`],
      ['帧率', `${timeline.events.video.fps}fps`],
      ['点击事件', `${effectiveClickCount} 次`],
      ['键盘事件', `${effectiveKeyCount} 次`],
      ['麦克风轨', current.audioUrl ? '有' : '无'],
      ['系统音频轨', current.systemAudioUrl ? '有' : '无']
    ]
    return (
      <motion.div
        key={current.session.sessionId}
        variants={detailEntrance}
        initial="initial"
        animate="enter"
        className="relative flex min-h-0 flex-1 flex-col"
      >
        {/* 工具栏：会话标识 + 导出操作 */}
        {!focusMode && <motion.div variants={detailSectionEntrance} className="flex h-[52px] flex-none items-center justify-between border-b border-line px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <Button variant="ghost" size="sm" onClick={closeSession} aria-label="返回会话列表">
              <ChevronLeftIcon size={15} />
            </Button>
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="flex-none text-[13px] font-medium text-ink-1">
                {formatDayLabel(current.session.startedAt)}{' '}
                {formatTimeOfDay(current.session.startedAt)}
              </span>
              <span className="truncate font-mono text-[11px] text-ink-3">
                {current.session.sessionId}
              </span>
            </div>
            <Chip>{formatDuration(durationMs)}</Chip>
            <Chip>
              {timeline.canvas.width} x {timeline.canvas.height} · {timeline.events.video.fps}fps
            </Chip>
            <EditSaveStatus state={saveState} onRetry={retrySave} />
          </div>
          <div className="flex items-center gap-2">
            <PreviewLayoutControls
              scaleMode={scaleMode}
              quality={previewQuality}
              inspectorOpen={inspectorOpen}
              onEnterFocus={() => onFocusModeChange(true)}
              onScaleModeChange={setScaleMode}
              onQualityChange={(quality) => void updateSettings({ previewQuality: quality })}
              onToggleInspector={() => setInspectorOpen((open) => !open)}
            />
            <Button
              variant="outline"
              onClick={() => void window.api.revealSession(current.session.sessionId)}
            >
              <FolderIcon size={14} />
              打开文件位置
            </Button>
            <ExportControls />
          </div>
        </motion.div>}

        <motion.div variants={detailSectionEntrance} className="flex min-h-0 flex-1">
          <PreviewPlayer
            timeline={timeline}
            videoUrl={current.videoUrl}
            audioUrl={current.audioUrl}
            systemAudioUrl={current.systemAudioUrl}
            systemAudioOffsetSec={current.systemAudioOffsetSec}
            keyframes={keyframes}
            ripples={ripples}
            scaleMode={scaleMode}
            quality={previewQuality}
            focusMode={focusMode}
            onPerformanceIssue={notifyPerformanceIssue}
            onExitFocus={() => onFocusModeChange(false)}
          />

          {/* 检查器：运镜参数 / 裁剪 / 会话信息，区块间以 hairline 分隔 */}
          <AnimatePresence>
            {!focusMode && inspectorOpen && (
              <motion.aside
                key="inspector"
                initial={{ width: 0, opacity: 0, x: 16 }}
                animate={{ width: 280, opacity: 1, x: 0 }}
                exit={{ width: 0, opacity: 0, x: 16 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="min-h-0 flex-none overflow-hidden border-l border-line bg-surface-1"
              >
                <div className="flex h-full w-[280px] flex-col overflow-y-auto">
                  <MotionParamsPanel />
                  <AudioPanel />
                  <BackgroundPanel />
                  <CutsPanel />
                  <section className="px-4 py-3.5">
                    <h3 className="mb-3 text-[11px] font-semibold tracking-[0.4px] text-ink-3">
                      会话信息
                    </h3>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                      {infoRows.map(([label, value]) => (
                        <div key={label} className="flex min-w-0 flex-col gap-0.5">
                          <dt className="text-[11px] text-ink-3">{label}</dt>
                          <dd className="truncate font-mono text-[12px] text-ink-1">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        </motion.div>
        {!focusMode && editLoadError && (
          <div className="absolute left-6 top-[62px] z-20 rounded-lg bg-amber-950/90 px-3 py-2 text-xs text-amber-300 shadow-lg">
            编辑数据未恢复：{editLoadError}
          </div>
        )}
      </motion.div>
    )
  }

  return (
    <SessionList
      sessions={sessions}
      sessionsLoaded={sessionsLoaded}
      loading={loading}
      loadError={loadError}
      onRefresh={() => void loadSessions()}
      onOpen={(sessionId) => openSession(sessionId)}
      onSessionAction={(action, sessionId) => {
        if (action === 'trash') return trashSession(sessionId)
        if (action === 'restore') return restoreSession(sessionId)
        if (action === 'delete-permanent') return deleteSessionPermanent(sessionId)
        return removeMissingSession(sessionId)
      }}
      onEmptyTrash={emptyTrash}
    />
  )
}
