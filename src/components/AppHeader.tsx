import { Settings } from 'lucide-react'
import { AppLogo } from '@/components/AppLogo'
import { ThemeSwitch } from '@/components/ThemeSwitch'
import { UpdateControl } from '@/components/UpdateControl'
import { WindowControls } from '@/components/WindowControls'
import { Button } from '@/components/ui/button'

interface AppHeaderProps {
  onOpenSettings(): void
}

function Brand(): React.JSX.Element {
  return (
    <div className="flex items-center gap-2.5">
      <AppLogo />
      <div>
        <h1 className="text-[15px] font-semibold leading-tight">Lenza</h1>
        <p className="text-[11.5px] text-ink-3">录制时采集数据，导出时自动运算</p>
      </div>
    </div>
  )
}

function HeaderActions({ onOpenSettings, windows }: AppHeaderProps & { windows: boolean }): React.JSX.Element {
  return (
    <div className="app-nodrag flex items-center gap-1" role="toolbar" aria-label="应用工具">
      <UpdateControl />
      <ThemeSwitch />
      <Button variant="ghost" size="sm" onClick={onOpenSettings} aria-label="打开应用设置">
        <Settings size={14} />
      </Button>
      {windows && <WindowControls />}
    </div>
  )
}

export function AppHeader({ onOpenSettings }: AppHeaderProps): React.JSX.Element {
  const isMac = window.api.platform === 'darwin'

  if (isMac) {
    return (
      <>
        <div className="app-drag flex h-10 flex-none items-center justify-end border-b border-line pl-[78px] pr-3">
          <HeaderActions onOpenSettings={onOpenSettings} windows={false} />
        </div>
        <header className="app-nodrag flex flex-none items-center px-6 pb-1 pt-3">
          <Brand />
        </header>
      </>
    )
  }

  return (
    <header
      className="app-drag flex flex-none items-center justify-between px-6 pb-1 pt-2"
      onDoubleClick={(event) => {
        if (event.target === event.currentTarget) void window.api.windowToggleMaximize()
      }}
    >
      <Brand />
      <HeaderActions onOpenSettings={onOpenSettings} windows />
    </header>
  )
}
