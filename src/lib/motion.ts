import type { Variants } from 'motion/react'

export const viewTransition: Variants = {
  initial: { opacity: 0, y: 8 },
  enter: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } },
  exit: { opacity: 0, y: -5, transition: { duration: 0.14, ease: 'easeIn' } }
}

export const staggerContainer: Variants = {
  initial: {},
  enter: { transition: { staggerChildren: 0.045, delayChildren: 0.03 } }
}

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 8 },
  enter: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } }
}
