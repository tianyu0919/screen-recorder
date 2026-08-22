import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { LogOut, Minimize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function CloseConfirmDialog(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [remember, setRemember] = useState(false)

  useEffect(() => window.api.onWindowCloseRequested(() => setOpen(true)), [])

  const resolve = async (behavior: 'background' | 'quit'): Promise<void> => {
    setOpen(false)
    await window.api.resolveWindowClose({ behavior, remember })
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] grid place-items-center bg-canvas/45 p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div role="dialog" aria-modal="true" aria-labelledby="close-title" initial={{ y: 10, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 6, scale: 0.98 }} className="w-full max-w-[420px] rounded-2xl border border-line bg-surface-1 p-5 shadow-float">
            <h2 id="close-title" className="text-base font-semibold text-ink-1">关闭 Lenza？</h2>
            <p className="mt-1.5 text-[12px] leading-5 text-ink-3">你可以让 Lenza 继续在后台运行，也可以完全退出应用。</p>
            <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs text-ink-2">
              <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
              不再提示，记住本次选择
            </label>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <Button variant="outline" className="h-10" onClick={() => void resolve('background')}><Minimize2 size={15} />后台运行</Button>
              <Button className="h-10" onClick={() => void resolve('quit')}><LogOut size={15} />直接退出</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
