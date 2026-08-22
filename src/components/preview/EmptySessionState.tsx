import { Clapperboard, RefreshCw, Trash2 } from 'lucide-react'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { staggerContainer, staggerItem } from '@/lib/motion'

interface EmptySessionStateProps {
  kind: 'active' | 'trash'
  onRefresh: () => void
}

export function EmptySessionState({ kind, onRefresh }: EmptySessionStateProps): React.JSX.Element {
  const trashed = kind === 'trash'
  const Icon = trashed ? Trash2 : Clapperboard

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="enter"
      className="relative grid min-h-[360px] place-items-center overflow-hidden rounded-2xl border border-dashed border-line bg-surface-1/55 px-6 py-14"
    >
      <div className="flex max-w-[340px] flex-col items-center text-center">
        <motion.div variants={staggerItem} className="relative mb-6 h-28 w-36" aria-hidden="true">
          <motion.div
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-x-3 bottom-1 top-3"
          >
            <div className="absolute inset-x-3 top-0 h-[76px] rotate-[-6deg] rounded-2xl border border-line bg-surface-2" />
            <div className="absolute inset-x-3 top-1 h-[76px] rotate-[6deg] rounded-2xl border border-line bg-surface-2" />
            <div className="absolute inset-x-2 top-2 grid h-[76px] place-items-center rounded-2xl border border-line-strong bg-surface-1 shadow-card">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent">
                <Icon size={22} strokeWidth={1.8} />
              </span>
            </div>
          </motion.div>
          <motion.span
            animate={{ opacity: [0.35, 0.8, 0.35], scale: [0.92, 1, 0.92] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute right-1 top-2 h-2 w-2 rounded-full bg-accent"
          />
        </motion.div>

        <motion.h3 variants={staggerItem} className="text-[15px] font-semibold text-ink-1">
          {trashed ? '回收站里很干净' : '还没有录制内容'}
        </motion.h3>
        <motion.p variants={staggerItem} className="mt-2 text-xs leading-5 text-ink-3">
          {trashed
            ? '移除的录制会暂存在这里，并在设定时间到期后自动清理。'
            : '完成第一段录制后，它会带着缩略图和时长出现在这里。'}
        </motion.p>
        <motion.div variants={staggerItem} className="mt-5">
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw size={13} />
            再检查一次
          </Button>
        </motion.div>
      </div>
    </motion.div>
  )
}
