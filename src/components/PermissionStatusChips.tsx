import type { PermissionStatus } from '@shared/types'
import { motion, useReducedMotion } from 'motion/react'
import { Chip } from '@/components/ui/chip'

const PERMISSION_ITEMS: Array<{
  key: keyof PermissionStatus
  label: string
}> = [
  { key: 'screen', label: '屏幕录制' },
  { key: 'accessibility', label: '辅助功能' },
  { key: 'microphone', label: '麦克风' }
]

export function PermissionStatusChips({ permissions }: { permissions: PermissionStatus }): React.JSX.Element {
  const reduceMotion = useReducedMotion()

  return (
    <div className="flex gap-2" role="status" aria-live="polite" aria-atomic="true">
      {PERMISSION_ITEMS.map((item, index) => {
        const granted = permissions[item.key] === 'granted'
        return (
          <motion.div
            key={`${item.key}-${permissions[item.key]}`}
            initial={reduceMotion ? false : { opacity: 0, y: 3, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.2, delay: reduceMotion ? 0 : index * 0.04, ease: 'easeOut' }}
          >
            <Chip>
              <motion.span
                aria-hidden="true"
                className={`h-[7px] w-[7px] rounded-full ${granted ? 'status-dot-success' : 'status-dot-warning'}`}
                initial={reduceMotion ? false : { opacity: 0.45, scale: 0.75 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.18, delay: reduceMotion ? 0 : index * 0.04 + 0.03, ease: 'easeOut' }}
              />
              {item.label}
              {granted ? '已授权' : '未授权'}
            </Chip>
          </motion.div>
        )
      })}
    </div>
  )
}
