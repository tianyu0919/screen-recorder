import { create } from 'zustand'

/** 主题模式：system 跟随 OS；色板见 index.css 的 [data-theme] 变量 */
export type ThemeMode = 'system' | 'light' | 'dark'

const media = window.matchMedia('(prefers-color-scheme: dark)')

function resolve(mode: ThemeMode): 'light' | 'dark' {
  if (mode !== 'system') return mode
  return media.matches ? 'dark' : 'light'
}

function apply(mode: ThemeMode): void {
  document.documentElement.dataset.theme = resolve(mode)
}

interface ThemeState {
  mode: ThemeMode
  setMode(mode: ThemeMode, persist?: boolean): void
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'light',
  setMode: (mode, persist = true) => {
    apply(mode)
    set({ mode })
    if (persist) void window.api.updateSettings({ theme: mode })
  }
}))

/** 应用主题并在 system 模式下跟随 OS 变化；需在渲染前调用（main.tsx）避免闪烁 */
export function initTheme(): void {
  apply(useThemeStore.getState().mode)
  media.addEventListener('change', () => {
    if (useThemeStore.getState().mode === 'system') apply('system')
  })
}
