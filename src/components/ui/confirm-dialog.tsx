import { AnimatePresence, motion } from 'motion/react'
import { Button } from './button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  destructive?: boolean
  busy?: boolean
  onCancel(): void
  onConfirm(): void
}

export function ConfirmDialog(props: ConfirmDialogProps): React.JSX.Element {
  return <AnimatePresence>{props.open && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[65] grid place-items-center bg-canvas/45 p-6"><motion.div role="alertdialog" aria-modal="true" initial={{ y: 8, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 5, scale: 0.98 }} className="w-full max-w-[390px] rounded-2xl border border-line bg-surface-1 p-5 shadow-float"><h2 className="text-base font-semibold text-ink-1">{props.title}</h2><p className="mt-2 text-xs leading-5 text-ink-3">{props.description}</p><div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={props.onCancel} disabled={props.busy}>取消</Button><Button variant={props.destructive ? 'destructive' : 'default'} onClick={props.onConfirm} disabled={props.busy}>{props.busy ? '处理中…' : props.confirmLabel}</Button></div></motion.div></motion.div>}</AnimatePresence>
}
