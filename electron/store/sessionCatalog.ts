import { app } from 'electron'
import { cp, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { accessSync, constants, existsSync, readFileSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { RecordingSession } from '../../shared/types'
import { appSettings } from './appSettings'

interface IndexEntry {
  sessionId: string
  dir: string
  startedAt: number
  editedAt?: number
  lifecycle: 'active' | 'trashed'
  trashedAt?: number
  purgeAt?: number
  originalDir?: string
  cleanupFailed?: boolean
}

const SESSION_ID_RE = /^[\w-]+$/

function isWithin(root: string, target: string): boolean {
  const rel = relative(resolve(root), resolve(target))
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))
}

function readTimes(dir: string): Pick<IndexEntry, 'startedAt' | 'editedAt'> | null {
  const eventsPath = join(dir, 'events.json')
  if (!existsSync(eventsPath)) return null
  let startedAt = statSync(eventsPath).mtimeMs
  try {
    const value = JSON.parse(readFileSync(eventsPath, 'utf8')) as { startTime?: unknown }
    if (typeof value.startTime === 'number') startedAt = value.startTime
  } catch { /* 加载阶段给出具体错误。 */ }
  const editPath = join(dir, 'edit.json')
  let editedAt: number | undefined
  if (existsSync(editPath)) {
    editedAt = statSync(editPath).mtimeMs
    try {
      const value = JSON.parse(readFileSync(editPath, 'utf8')) as { updatedAt?: unknown }
      const parsed = typeof value.updatedAt === 'string' ? Date.parse(value.updatedAt) : NaN
      if (Number.isFinite(parsed)) editedAt = parsed
    } catch { /* 同上。 */ }
  }
  return { startedAt, editedAt }
}

function canAccessRoot(root: string): boolean {
  try { accessSync(root, constants.R_OK); return true } catch { return false }
}

export class SessionCatalog {
  private entries = new Map<string, IndexEntry>()
  private loaded = false
  private persistQueue: Promise<void> = Promise.resolve()

  get trashRoot(): string {
    return join(app.getPath('userData'), 'trash')
  }

  private get indexPath(): string {
    return join(app.getPath('userData'), 'session-index.json')
  }

  load(): void {
    if (this.loaded) return
    this.loaded = true
    try {
      const source = existsSync(this.indexPath) ? this.indexPath : `${this.indexPath}.bak`
      const parsed = JSON.parse(readFileSync(source, 'utf8')) as { entries?: IndexEntry[] }
      for (const entry of parsed.entries ?? []) {
        if (SESSION_ID_RE.test(entry.sessionId)) this.entries.set(entry.sessionId, entry)
      }
    } catch { /* 首次运行或损坏时通过磁盘扫描重建可用部分。 */ }
    try {
      for (const name of readdirSync(dirname(this.indexPath))) {
        if (name.startsWith('session-index.json.') && name.endsWith('.tmp')) {
          unlinkSync(join(dirname(this.indexPath), name))
        }
      }
    } catch { /* 临时文件清理不阻断启动。 */ }
    this.scanRoots()
    void this.persist().catch(() => {})
  }

  scanRoots(): void {
    for (const root of appSettings.get().recordingRoots) {
      if (!existsSync(root)) continue
      let children: string[]
      try { children = readdirSync(root) } catch { continue }
      for (const sessionId of children) {
        if (!SESSION_ID_RE.test(sessionId)) continue
        const dir = join(root, sessionId)
        try {
          if (!statSync(dir).isDirectory()) continue
          const times = readTimes(dir)
          if (!times) continue
          this.entries.set(sessionId, { sessionId, dir, ...times, lifecycle: 'active' })
        } catch { /* 单个会话不阻塞列表。 */ }
      }
    }
  }

  register(sessionId: string, dir: string, startedAt = Date.now()): void {
    if (!SESSION_ID_RE.test(sessionId)) throw new Error('非法会话 ID')
    this.load()
    this.entries.set(sessionId, { sessionId, dir: resolve(dir), startedAt, lifecycle: 'active' })
    void this.persist().catch(() => {})
  }

  list(): RecordingSession[] {
    this.load()
    this.scanRoots()
    void this.persist().catch(() => {})
    const roots = appSettings.get().recordingRoots
    return [...this.entries.values()].map((entry) => {
      const root = roots.find((item) => isWithin(item, entry.lifecycle === 'active' ? entry.dir : entry.originalDir ?? entry.dir))
      const rootAvailable = entry.lifecycle === 'trashed' || (root !== undefined && canAccessRoot(root))
      const availability: NonNullable<RecordingSession['availability']> = !rootAvailable
        ? 'storage-unavailable'
        : existsSync(entry.dir)
          ? 'available'
          : 'source-missing'
      return { ...entry, availability }
    }).sort((a, b) => (b.editedAt ?? b.startedAt) - (a.editedAt ?? a.startedAt))
  }

  resolveSessionDir(sessionId: string, allowTrash = false): string {
    this.load()
    const entry = this.entries.get(sessionId)
    if (!entry || (!allowTrash && entry.lifecycle !== 'active')) throw new Error('会话不存在')
    const allowed = entry.lifecycle === 'trashed'
      ? isWithin(this.trashRoot, entry.dir)
      : appSettings.get().recordingRoots.some((root) => isWithin(root, entry.dir))
    if (!allowed || !existsSync(entry.dir)) throw new Error('会话文件不可用')
    return entry.dir
  }

  async trash(sessionId: string): Promise<void> {
    const entry = this.requireEntry(sessionId, 'active')
    this.resolveSessionDir(sessionId)
    await mkdir(this.trashRoot, { recursive: true })
    const target = join(this.trashRoot, sessionId)
    if (existsSync(target)) throw new Error('回收站中存在同名录制')
    await this.move(entry.dir, target)
    const trashedAt = Date.now()
    const days = appSettings.get().trashRetentionDays
    Object.assign(entry, {
      lifecycle: 'trashed', dir: target, originalDir: entry.dir, trashedAt,
      purgeAt: days === null ? undefined : trashedAt + days * 86_400_000,
      cleanupFailed: false
    })
    await this.persist()
  }

  async restore(sessionId: string): Promise<void> {
    const entry = this.requireEntry(sessionId, 'trashed')
    this.resolveSessionDir(sessionId, true)
    const target = entry.originalDir
    if (!target) throw new Error('缺少原始保存位置')
    const root = appSettings.get().recordingRoots.find((item) => isWithin(item, target))
    if (!root || !canAccessRoot(root)) throw new Error('原存储位置不可用')
    if (existsSync(target)) throw new Error('原位置存在同名录制，无法覆盖')
    await this.move(entry.dir, target)
    Object.assign(entry, { lifecycle: 'active', dir: target })
    delete entry.originalDir; delete entry.trashedAt; delete entry.purgeAt; delete entry.cleanupFailed
    await this.persist()
  }

  async deletePermanent(sessionId: string): Promise<void> {
    const entry = this.requireEntry(sessionId, 'trashed')
    if (!isWithin(this.trashRoot, entry.dir)) throw new Error('回收站路径非法')
    if (existsSync(entry.dir)) await rm(entry.dir, { recursive: true, force: false })
    this.entries.delete(sessionId)
    await this.persist()
  }

  async emptyTrash(): Promise<void> {
    for (const entry of [...this.entries.values()]) {
      if (entry.lifecycle === 'trashed') await this.deletePermanent(entry.sessionId)
    }
  }

  async removeMissing(sessionId: string): Promise<void> {
    const entry = this.requireEntry(sessionId, 'active')
    const roots = appSettings.get().recordingRoots
    const root = roots.find((item) => isWithin(item, entry.dir))
    if (!root || !canAccessRoot(root)) throw new Error('存储位置暂不可用，不能移除记录')
    if (existsSync(entry.dir)) throw new Error('会话文件仍然存在')
    this.entries.delete(sessionId)
    await this.persist()
  }

  async purgeExpired(): Promise<void> {
    const now = Date.now()
    for (const entry of [...this.entries.values()]) {
      if (entry.lifecycle !== 'trashed' || entry.purgeAt === undefined || entry.purgeAt > now) continue
      try { await this.deletePermanent(entry.sessionId) }
      catch { entry.cleanupFailed = true; await this.persist() }
    }
  }

  async updateRetention(): Promise<void> {
    const days = appSettings.get().trashRetentionDays
    for (const entry of this.entries.values()) {
      if (entry.lifecycle !== 'trashed' || entry.trashedAt === undefined) continue
      entry.purgeAt = days === null ? undefined : entry.trashedAt + days * 86_400_000
    }
    await this.persist()
    await this.purgeExpired()
  }

  private requireEntry(sessionId: string, lifecycle: IndexEntry['lifecycle']): IndexEntry {
    if (!SESSION_ID_RE.test(sessionId)) throw new Error('非法会话 ID')
    this.load()
    const entry = this.entries.get(sessionId)
    if (!entry || entry.lifecycle !== lifecycle) throw new Error('会话状态已变化，请刷新后重试')
    return entry
  }

  private async move(source: string, target: string): Promise<void> {
    await mkdir(dirname(target), { recursive: true })
    try { await rename(source, target) }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error
      try {
        await cp(source, target, { recursive: true, errorOnExist: true })
        await rm(source, { recursive: true, force: false })
      } catch (copyError) {
        await rm(target, { recursive: true, force: true }).catch(() => {})
        throw copyError
      }
    }
  }

  private async persist(): Promise<void> {
    const payload = JSON.stringify({ version: 1, entries: [...this.entries.values()] }, null, 2)
    this.persistQueue = this.persistQueue.catch(() => {}).then(async () => {
      await mkdir(dirname(this.indexPath), { recursive: true })
      const temp = `${this.indexPath}.${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`
      await writeFile(temp, payload)
      if (process.platform !== 'win32' || !existsSync(this.indexPath)) {
        await rename(temp, this.indexPath)
        return
      }
      const backup = `${this.indexPath}.bak`
      await rm(backup, { force: true })
      await rename(this.indexPath, backup)
      try { await rename(temp, this.indexPath); await rm(backup, { force: true }) }
      catch (error) { await rename(backup, this.indexPath); throw error }
    })
    return this.persistQueue
  }
}

export const sessionCatalog = new SessionCatalog()
