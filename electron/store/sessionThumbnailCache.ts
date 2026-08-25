import { app } from 'electron'
import { closeSync, existsSync, openSync, readFileSync, readSync, statSync } from 'node:fs'
import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { SaveSessionThumbnailRequest, SessionThumbnailInfo } from '../../shared/sessionThumbnail'
import { sessionCatalog } from './sessionCatalog'
import {
  isWebp,
  matchesThumbnailSource,
  MAX_THUMBNAIL_BYTES,
  normalizeThumbnailDuration,
  type ThumbnailMetadata
} from './sessionThumbnailData'

const SESSION_ID_RE = /^[\w-]+$/

export class SessionThumbnailCache {
  getInfo(sessionId: string): SessionThumbnailInfo | null {
    const validated = this.validate(sessionId)
    if (!validated) return null
    return {
      url: `media://thumb/${sessionId}/thumbnail.webp?v=${Math.round(validated.sourceMtimeMs)}`,
      durationMs: validated.durationMs
    }
  }

  resolveImage(sessionId: string): string | null {
    return this.validate(sessionId) ? this.imagePath(sessionId) : null
  }

  async save(request: SaveSessionThumbnailRequest): Promise<SessionThumbnailInfo> {
    if (!SESSION_ID_RE.test(request.sessionId)) throw new Error('非法会话 ID')
    if (request.webp.byteLength > MAX_THUMBNAIL_BYTES) throw new Error('缩略图格式或大小无效')
    const bytes = Buffer.from(request.webp)
    if (!isWebp(bytes)) throw new Error('缩略图格式或大小无效')
    const source = this.sourcePath(request.sessionId)
    const stat = statSync(source)
    const metadata: ThumbnailMetadata = {
      version: 1,
      sessionId: request.sessionId,
      durationMs: normalizeThumbnailDuration(request.durationMs),
      sourceSize: stat.size,
      sourceMtimeMs: stat.mtimeMs,
      updatedAt: new Date().toISOString()
    }
    await mkdir(this.root, { recursive: true })
    const suffix = `${process.pid}-${Date.now()}`
    const imageTemp = `${this.imagePath(request.sessionId)}.${suffix}.tmp`
    const metadataTemp = `${this.metadataPath(request.sessionId)}.${suffix}.tmp`
    try {
      await writeFile(imageTemp, bytes, { flag: 'wx' })
      await writeFile(metadataTemp, JSON.stringify(metadata), { flag: 'wx' })
      await Promise.all([
        rm(this.imagePath(request.sessionId), { force: true }),
        rm(this.metadataPath(request.sessionId), { force: true })
      ])
      await rename(imageTemp, this.imagePath(request.sessionId))
      await rename(metadataTemp, this.metadataPath(request.sessionId))
    } catch (error) {
      await Promise.all([rm(imageTemp, { force: true }), rm(metadataTemp, { force: true })])
      throw error
    }
    return this.getInfo(request.sessionId)!
  }

  async remove(sessionId: string): Promise<void> {
    if (!SESSION_ID_RE.test(sessionId)) return
    await Promise.all([
      rm(this.imagePath(sessionId), { force: true }),
      rm(this.metadataPath(sessionId), { force: true })
    ])
  }

  async prune(validSessionIds: Set<string>): Promise<void> {
    let names: string[]
    try { names = await readdir(this.root) } catch { return }
    const orphanIds = new Set(names.map((name) => name.replace(/\.(webp|json)$/, ''))
      .filter((sessionId) => SESSION_ID_RE.test(sessionId) && !validSessionIds.has(sessionId)))
    await Promise.all([...orphanIds].map((sessionId) => this.remove(sessionId)))
  }

  private validate(sessionId: string): ThumbnailMetadata | null {
    if (!SESSION_ID_RE.test(sessionId)) return null
    const image = this.imagePath(sessionId), metadataPath = this.metadataPath(sessionId)
    if (!existsSync(image) || !existsSync(metadataPath)) return null
    try {
      const metadata = JSON.parse(readFileSync(metadataPath, 'utf8')) as ThumbnailMetadata
      const source = statSync(this.sourcePath(sessionId))
      const valid = matchesThumbnailSource(metadata, sessionId, source, statSync(image).size) &&
        isWebp(readHeader(image))
      if (valid) return metadata
    } catch { /* 缺失、损坏或不可访问时按无缓存处理。 */ }
    void this.remove(sessionId).catch(() => {})
    return null
  }

  private sourcePath(sessionId: string): string {
    return join(sessionCatalog.resolveSessionDir(sessionId, true), 'screen.webm')
  }

  private get root(): string {
    return join(app.getPath('userData'), 'cache', 'session-thumbnails')
  }

  private imagePath(sessionId: string): string { return join(this.root, `${sessionId}.webp`) }
  private metadataPath(sessionId: string): string { return join(this.root, `${sessionId}.json`) }
}

function readHeader(path: string): Uint8Array {
  const value = Buffer.alloc(12), fd = openSync(path, 'r')
  try { readSync(fd, value, 0, value.length, 0) } finally { closeSync(fd) }
  return value
}

export const sessionThumbnailCache = new SessionThumbnailCache()
