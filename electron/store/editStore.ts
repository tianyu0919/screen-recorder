import { existsSync } from 'node:fs'
import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { extname, join, normalize, sep } from 'node:path'
import type { SessionEditSaveResult } from '../../shared/edit'
import { recordingsRoot } from './sessionReader'

const SESSION_ID_RE = /^[\w-]+$/
const ASSET_ID_RE = /^[\w-]{8,}$/
const AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.m4a', '.aac', '.ogg', '.flac'])

function sessionDir(sessionId: string): string {
  if (!SESSION_ID_RE.test(sessionId)) throw new Error('非法会话 ID')
  const dir = join(recordingsRoot(), sessionId)
  if (!existsSync(dir)) throw new Error('会话不存在')
  return dir
}

function safeAssetPath(sessionId: string, assetFile: string): string {
  const dir = sessionDir(sessionId)
  const root = join(dir, 'custom-audio')
  const abs = normalize(join(dir, assetFile))
  if (!abs.startsWith(root + sep) || !AUDIO_EXTENSIONS.has(extname(abs).toLowerCase())) {
    throw new Error('非法音频资产路径')
  }
  return abs
}

export async function saveEditJson(
  sessionId: string,
  json: string
): Promise<SessionEditSaveResult> {
  const dir = sessionDir(sessionId)
  // Main 只接收 JSON；Renderer 负责版本校验，Main 再做最低限度语法保护。
  JSON.parse(json)
  const target = join(dir, 'edit.json')
  const temp = join(dir, `.edit-${process.pid}-${Date.now()}.tmp`)
  const handle = await open(temp, 'w')
  try {
    await handle.writeFile(json, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
  await rename(temp, target)
  return { updatedAt: Date.now() }
}

export async function saveAudioAsset(
  sessionId: string,
  assetId: string,
  sourceName: string,
  data: ArrayBuffer
): Promise<string> {
  if (!ASSET_ID_RE.test(assetId)) throw new Error('非法音频资产 ID')
  const ext = extname(sourceName).toLowerCase()
  if (!AUDIO_EXTENSIONS.has(ext)) throw new Error('不支持的音频格式')
  if (data.byteLength > 200 * 1024 * 1024) throw new Error('音频文件过大（上限 200MB）')
  const dir = sessionDir(sessionId)
  const assetDir = join(dir, 'custom-audio')
  await mkdir(assetDir, { recursive: true })
  const fileName = `${assetId}${ext}`
  await writeFile(join(assetDir, fileName), Buffer.from(data))
  return `custom-audio/${fileName}`
}

export async function loadAudioAsset(sessionId: string, assetFile: string): Promise<ArrayBuffer> {
  const data = await readFile(safeAssetPath(sessionId, assetFile))
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
}

export async function deleteAudioAsset(sessionId: string, assetFile: string): Promise<void> {
  try {
    await unlink(safeAssetPath(sessionId, assetFile))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}
