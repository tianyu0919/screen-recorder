import { useThemeStore, type ThemeMode } from '@/store/themeStore'
import { MonitorIcon, MoonIcon, SunIcon } from '@/components/icons'

const ORDER: ThemeMode[] = ['system', 'light', 'dark']

const META: Record<ThemeMode, { label: string; Icon: typeof SunIcon }> = {
  system: { label: '跟随系统', Icon: MonitorIcon },
  light: { label: '浅色', Icon: SunIcon },
  dark: { label: '深色', Icon: MoonIcon }
}

/** 主题切换按钮：循环 跟随系统 → 浅色 → 深色，选择持久化到 localStorage */
export function ThemeSwitch(): React.JSX.Element {
  const { mode, setMode } = useThemeStore()
  const { label, Icon } = META[mode]
  const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length]

  return (
    <button
      type="button"
      onClick={() => setMode(next)}
      title={`主题：${label}（点击切换）`}
      aria-label={`主题：${label}，切换到${META[next].label}`}
      className="flex h-7 w-7 items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink-1"
    >
      <Icon size={14} />
    </button>
  )
}
