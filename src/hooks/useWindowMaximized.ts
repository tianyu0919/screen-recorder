import { useCallback, useEffect, useState } from 'react'

/** Main 窗口最大化状态的 Renderer 镜像；初始查询避免组件错过早期窗口事件。 */
export function useWindowMaximized(): {
  maximized: boolean
  toggleMaximized(): void
} {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    let active = true
    void window.api.windowIsMaximized().then((value) => {
      if (active) setMaximized(value)
    })
    const unsubscribe = window.api.onMaximizedChange(setMaximized)
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const toggleMaximized = useCallback(() => {
    void window.api.windowToggleMaximize()
  }, [])

  return { maximized, toggleMaximized }
}
