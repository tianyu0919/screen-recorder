import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import type { AppSettings, CloseBehavior, ThemeMode, TrashRetentionDays } from '../../shared/types'

const SETTINGS_FILE = 'settings.json'
const RETENTIONS: TrashRetentionDays[] = [1, 3, 7, 30, null]

function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths.map((item) => resolve(item)))]
}

function defaults(): AppSettings {
  const recordingsPath = join(app.getPath('videos'), 'Lenza')
  const legacyPath = join(app.getPath('userData'), 'recordings')
  return {
    version: 1,
    theme: 'light',
    recordingsPath,
    recordingRoots: uniquePaths([recordingsPath, legacyPath]),
    trashRetentionDays: 3,
    closeBehavior: null
  }
}

function isTheme(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark'
}

function isCloseBehavior(value: unknown): value is CloseBehavior | null {
  return value === null || value === 'background' || value === 'quit'
}

function parseSettings(value: unknown): AppSettings {
  const base = defaults()
  if (!value || typeof value !== 'object') return base
  const data = value as Partial<AppSettings>
  const recordingsPath =
    typeof data.recordingsPath === 'string' && data.recordingsPath.length > 0
      ? resolve(data.recordingsPath)
      : base.recordingsPath
  const roots = Array.isArray(data.recordingRoots)
    ? data.recordingRoots.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : []
  return {
    version: 1,
    theme: isTheme(data.theme) ? data.theme : base.theme,
    recordingsPath,
    recordingRoots: uniquePaths([...roots, recordingsPath, ...base.recordingRoots]),
    trashRetentionDays: RETENTIONS.includes(data.trashRetentionDays as TrashRetentionDays)
      ? (data.trashRetentionDays as TrashRetentionDays)
      : base.trashRetentionDays,
    closeBehavior: isCloseBehavior(data.closeBehavior) ? data.closeBehavior : null
  }
}

export class AppSettingsStore {
  private value: AppSettings | null = null

  private get filePath(): string {
    return join(app.getPath('userData'), SETTINGS_FILE)
  }

  get(): AppSettings {
    if (this.value) return structuredClone(this.value)
    try {
      const source = existsSync(this.filePath) ? this.filePath : `${this.filePath}.bak`
      this.value = existsSync(source)
        ? parseSettings(JSON.parse(readFileSync(source, 'utf8')))
        : defaults()
    } catch {
      this.value = defaults()
    }
    mkdirSync(this.value.recordingsPath, { recursive: true })
    this.persist()
    return structuredClone(this.value)
  }

  update(patch: Partial<Pick<AppSettings, 'theme' | 'trashRetentionDays' | 'closeBehavior'>>): AppSettings {
    const current = this.get()
    this.value = parseSettings({
      ...current,
      ...(patch.theme !== undefined ? { theme: patch.theme } : {}),
      ...(patch.trashRetentionDays !== undefined ? { trashRetentionDays: patch.trashRetentionDays } : {}),
      ...(patch.closeBehavior !== undefined ? { closeBehavior: patch.closeBehavior } : {})
    })
    this.persist()
    return this.get()
  }

  setRecordingsPath(path: string): AppSettings {
    const current = this.get()
    const recordingsPath = resolve(path)
    mkdirSync(recordingsPath, { recursive: true })
    this.value = parseSettings({
      ...current,
      recordingsPath,
      recordingRoots: [...current.recordingRoots, recordingsPath]
    })
    this.persist()
    return this.get()
  }

  private persist(): void {
    if (!this.value) return
    mkdirSync(dirname(this.filePath), { recursive: true })
    const temp = `${this.filePath}.tmp`
    writeFileSync(temp, JSON.stringify(this.value, null, 2), 'utf8')
    if (process.platform !== 'win32' || !existsSync(this.filePath)) {
      renameSync(temp, this.filePath)
      return
    }
    const backup = `${this.filePath}.bak`
    if (existsSync(backup)) unlinkSync(backup)
    renameSync(this.filePath, backup)
    try { renameSync(temp, this.filePath); unlinkSync(backup) }
    catch (error) { renameSync(backup, this.filePath); throw error }
  }
}

export const appSettings = new AppSettingsStore()
