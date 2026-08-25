import type { RecordingSession } from '@shared/types'
import { AnimatePresence, motion } from 'motion/react'
import { staggerContainer } from '@/lib/motion'
import { useGridFlip } from '@/hooks/useGridFlip'
import { SessionCard, type SessionAction } from './SessionCard'
import type { SessionThumbnailInfo } from '@shared/sessionThumbnail'

interface SessionGridProps {
  sessions: RecordingSession[]
  disabled: boolean
  onOpen: (sessionId: string) => void
  onAction: (action: SessionAction, session: RecordingSession) => void
  onThumbnailReady(sessionId: string, thumbnail: SessionThumbnailInfo): void
}

export function SessionGrid({ sessions, disabled, onOpen, onAction, onThumbnailReady }: SessionGridProps): React.JSX.Element {
  const itemKey = sessions.map((session) => session.sessionId).join('|')
  const gridRef = useGridFlip(itemKey)

  return (
    <motion.div
      ref={gridRef}
      variants={staggerContainer}
      initial="initial"
      animate="enter"
      className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4 min-[1360px]:grid-cols-5"
    >
      <AnimatePresence mode="popLayout">
        {sessions.map((session) => (
          <motion.div
            key={session.sessionId}
            data-grid-flip-item={session.sessionId}
            exit={{ opacity: 0, transition: { duration: 0.18, ease: 'easeOut' } }}
            className="min-w-0"
          >
            <SessionCard session={session} disabled={disabled} onOpen={onOpen} onAction={onAction}
              onThumbnailReady={(thumbnail) => onThumbnailReady(session.sessionId, thumbnail)} />
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  )
}
