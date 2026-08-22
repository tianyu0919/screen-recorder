import { motion } from 'motion/react'

export function PreviewLoadingState(): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-6" role="status" aria-label="正在加载预览编辑器">
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[420px] rounded-2xl border border-line bg-surface-1 p-5 shadow-card"
      >
        <div className="flex items-center gap-3">
          <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-accent-soft">
            <motion.span className="h-3 w-3 rounded-full bg-accent" animate={{ scale: [0.7, 1, 0.7], opacity: [0.45, 1, 0.45] }} transition={{ duration: 1.2, repeat: Infinity }} />
          </span>
          <div className="flex-1"><p className="text-sm font-medium text-ink-1">正在准备预览编辑器</p><p className="mt-1 text-[11px] text-ink-3">加载播放器、时间轴与编辑工具…</p></div>
        </div>
        <div className="mt-5 space-y-2.5" aria-hidden>
          <div className="h-2.5 w-3/4 rounded-full bg-surface-3" />
          <div className="h-2.5 w-full rounded-full bg-surface-3" />
          <div className="h-2.5 w-5/6 rounded-full bg-surface-3" />
        </div>
      </motion.div>
    </div>
  )
}
