import { create } from 'zustand'
import type {
  AppSettings,
  AppSettingsPatch,
  CloseBehavior,
  PreviewQualityMode,
  ThemeMode,
  TrashRetentionDays
} from '@shared/types'
import { useThemeStore } from './themeStore'

interface SettingsState {
  settings: AppSettings | null
  loading: boolean
  error: string | null
  load(): Promise<void>
  update(patch: AppSettingsPatch): Promise<void>
  chooseRecordingsPath(): Promise<void>
  openRecordingsPath(): Promise<void>
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  loading: false,
  error: null,
  async load() {
    set({ loading: true, error: null })
    try {
      let settings = await window.api.getSettings()
      const legacyTheme = localStorage.getItem('lenza-theme')
      if (legacyTheme === 'system' || legacyTheme === 'light' || legacyTheme === 'dark') {
        settings = await window.api.updateSettings({ theme: legacyTheme })
        localStorage.removeItem('lenza-theme')
      }
      useThemeStore.getState().setMode(settings.theme, false)
      set({ settings, loading: false })
    } catch (error) {
      set({ loading: false, error: `无法加载设置：${message(error)}` })
    }
  },
  async update(patch) {
    const previous = get().settings
    if (!previous) return
    set({ settings: { ...previous, ...patch }, error: null })
    if (patch.theme) useThemeStore.getState().setMode(patch.theme, false)
    try {
      set({ settings: await window.api.updateSettings(patch) })
    } catch (error) {
      set({ settings: previous, error: `保存设置失败：${message(error)}` })
      useThemeStore.getState().setMode(previous.theme, false)
    }
  },
  async chooseRecordingsPath() {
    set({ error: null })
    try {
      const settings = await window.api.chooseRecordingsPath()
      if (settings) set({ settings })
    } catch (error) {
      set({ error: `无法更改保存位置：${message(error)}` })
    }
  },
  async openRecordingsPath() {
    try { await window.api.openRecordingsPath() }
    catch (error) { set({ error: `无法打开保存位置：${message(error)}` }) }
  }
}))

export const THEME_OPTIONS: Array<{ value: ThemeMode; label: string }> = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' }
]

export const RETENTION_OPTIONS: Array<{ value: TrashRetentionDays; label: string }> = [
  { value: 1, label: '1 天' }, { value: 3, label: '3 天' },
  { value: 7, label: '7 天' }, { value: 30, label: '30 天' },
  { value: null, label: '永久保留' }
]

export const CLOSE_OPTIONS: Array<{ value: CloseBehavior; label: string }> = [
  { value: 'background', label: '后台运行' },
  { value: 'quit', label: '直接退出' }
]

export const PREVIEW_QUALITY_OPTIONS: Array<{ value: PreviewQualityMode; label: string }> = [
  { value: 'auto', label: '自动' },
  { value: 'smooth', label: '流畅' },
  { value: 'high', label: '高清' },
  { value: 'ultra', label: '超清' }
]
