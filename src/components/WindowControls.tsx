import { useEffect, useState } from 'react'
import { CloseIcon, MaximizeIcon, MinusIcon, RestoreIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

const btnClass =
  'flex h-7 w-9 items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink-1'

/** Windows 自绘窗口控制按钮（隐藏原生标题栏后由 Renderer 提供）；macOS 用系统红绿灯，返回 null */
export function WindowControls(): React.JSX.Element | null {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => window.api.onMaximizedChange(setMaximized), [])

  if (window.api.platform !== 'win32') return null

  return (
    <div className="app-nodrag flex items-stretch">
      <button
        type="button"
        aria-label="最小化"
        className={btnClass}
        onClick={() => void window.api.windowMinimize()}
      >
        <MinusIcon size={14} />
      </button>
      <button
        type="button"
        aria-label={maximized ? '还原' : '最大化'}
        className={btnClass}
        onClick={() => void window.api.windowToggleMaximize()}
      >
        {maximized ? <RestoreIcon size={13} /> : <MaximizeIcon size={13} />}
      </button>
      <button
        type="button"
        aria-label="关闭"
        className={cn(btnClass, 'hover:bg-[#e81123] hover:text-white')}
        onClick={() => void window.api.windowClose()}
      >
        <CloseIcon size={14} />
      </button>
    </div>
  )
}
