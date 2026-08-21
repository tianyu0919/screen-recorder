import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  fitStageSize,
  type PreviewScaleMode,
  type StageSize
} from '@/lib/stageFit'

export function useStageFit(
  mode: PreviewScaleMode,
  output: StageSize
): {
  stageRef: React.RefObject<HTMLDivElement>
  canvasSize: StageSize
} {
  const stageRef = useRef<HTMLDivElement>(null)
  const [available, setAvailable] = useState<StageSize>({ width: 0, height: 0 })

  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const update = (width: number, height: number): void => {
      const next = { width: Math.floor(width), height: Math.floor(height) }
      setAvailable((current) =>
        current.width === next.width && current.height === next.height ? current : next
      )
    }
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) update(rect.width, rect.height)
    })
    observer.observe(stage)
    update(stage.clientWidth, stage.clientHeight)
    return () => observer.disconnect()
  }, [])

  const canvasSize = useMemo(
    () => (mode === 'actual' ? output : fitStageSize(available, output)),
    [available, mode, output]
  )
  return { stageRef, canvasSize }
}
