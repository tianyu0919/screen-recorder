import { existsSync, readFileSync } from 'node:fs'
import { open, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { CaptionsDocument } from '../../shared/captions'
import { migrateCaptionsDocument, validateCaptionsDocument } from '../../shared/captions'
import { sessionCatalog } from './sessionCatalog'

export function loadCaptionsJson(sessionId: string): string | null {
  const path = join(sessionCatalog.resolveSessionDir(sessionId), 'captions.json')
  return existsSync(path) ? readFileSync(path, 'utf8') : null
}

export function loadCaptionsDocument(sessionId: string): CaptionsDocument | null {
  const json = loadCaptionsJson(sessionId)
  if (!json) return null
  try {
    const value = migrateCaptionsDocument(JSON.parse(json))
    return validateCaptionsDocument(value).length === 0 ? value as CaptionsDocument : null
  } catch { return null }
}

export async function saveCaptionsDocument(
  sessionId: string,
  document: CaptionsDocument,
  durationMs = Infinity
): Promise<{ updatedAt: number }> {
  const errors = validateCaptionsDocument(document, durationMs)
  if (errors.length) throw new Error(`字幕数据无效：${errors.join('；')}`)
  const dir = sessionCatalog.resolveSessionDir(sessionId)
  const target = join(dir, 'captions.json')
  const temporary = join(dir, `captions.json.${process.pid}.${Date.now()}.tmp`)
  try {
    const file = await open(temporary, 'wx')
    try {
      await file.writeFile(JSON.stringify(document, null, 2), 'utf8')
      await file.sync()
    } finally { await file.close() }
    await rename(temporary, target)
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {})
    throw error
  }
  return { updatedAt: Date.parse(document.updatedAt) || Date.now() }
}
