import { app, protocol, shell } from 'electron'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { open, readFile } from 'node:fs/promises'
import { join, normalize, sep } from 'node:path'
import type { RecordingSession, SessionLoadResult } from '../../shared/types'

/**
 * 录制会话读取（kr-02 Phase 3 预览）：
 * 枚举 recordings/ 下的已落盘会话、读取 events.json 原文（解析校验在 Renderer）、
 * 注册 media:// 自定义协议流式喂 <video>（net.fetch file:// 支持 Range，seek 不整文件读内存）。
 * 与 SessionStore（录制期落盘）分离：本模块只读。
 */

/** 会话根目录（与 SessionStore.rootDir 一致） */
export function recordingsRoot(): string {
  return join(app.getPath('userData'), 'recordings')
}

const SESSION_ID_RE = /^[\w-]+$/

/** 读取会话开始时间；events.json 损坏时回退到文件 mtime（不阻塞列表/加载） */
function readStartedAt(eventsPath: string): number {
  try {
    const parsed = JSON.parse(readFileSync(eventsPath, 'utf8')) as { startTime?: unknown }
    if (typeof parsed.startTime === 'number') return parsed.startTime
  } catch {
    /* 交给加载路径报错 */
  }
  return statSync(eventsPath).mtimeMs
}

/** 枚举已落盘会话（按开始时间倒序）；events.json 损坏的会话也列出，选中后走友好错误路径 */
export function listSessions(): RecordingSession[] {
  const root = recordingsRoot()
  if (!existsSync(root)) return []
  const out: RecordingSession[] = []
  for (const sessionId of readdirSync(root)) {
    try {
      const dir = join(root, sessionId)
      if (!statSync(dir).isDirectory()) continue
      const eventsPath = join(dir, 'events.json')
      if (!existsSync(eventsPath)) continue
      out.push({ sessionId, dir, startedAt: readStartedAt(eventsPath) })
    } catch {
      /* 单个会话读取失败不阻塞列表 */
    }
  }
  return out.sort((a, b) => b.startedAt - a.startedAt)
}

/** 加载会话：返回 events.json 原文 + 视频流式 URL；文件缺失抛错（IPC 包装为友好提示） */
export function loadSession(sessionId: string): SessionLoadResult {
  if (!SESSION_ID_RE.test(sessionId)) throw new Error('非法会话 ID')
  const dir = join(recordingsRoot(), sessionId)
  const eventsPath = join(dir, 'events.json')
  if (!existsSync(eventsPath)) throw new Error('会话不存在或缺少 events.json')
  const eventsJson = readFileSync(eventsPath, 'utf8')
  // 视频文件名取 events.json 的 video.file；损坏时按约定回退 screen.webm（解析错误由 Renderer 提示）
  let videoFile = 'screen.webm'
  try {
    const parsed = JSON.parse(eventsJson) as { video?: { file?: unknown } }
    if (typeof parsed.video?.file === 'string') videoFile = parsed.video.file
  } catch {
    /* 同上 */
  }
  if (!existsSync(join(dir, videoFile))) throw new Error('会话视频文件缺失')
  // 麦克风/系统音频可选轨：存在才给预览/导出用
  const audioUrl = existsSync(join(dir, 'mic.wav'))
    ? `media://rec/${sessionId}/mic.wav`
    : null
  const systemAudioUrl = existsSync(join(dir, 'system.wav'))
    ? `media://rec/${sessionId}/system.wav`
    : null
  return {
    session: { sessionId, dir, startedAt: readStartedAt(eventsPath) },
    eventsJson,
    videoUrl: `media://rec/${sessionId}/${encodeURIComponent(videoFile)}`,
    audioUrl,
    systemAudioUrl
  }
}

/** 在系统文件管理器（macOS Finder）中显示会话视频文件；文件缺失时回退到会话目录 */
export function revealSession(sessionId: string): void {
  if (!SESSION_ID_RE.test(sessionId)) throw new Error('非法会话 ID')
  const dir = join(recordingsRoot(), sessionId)
  if (!existsSync(dir)) throw new Error('会话不存在')
  const videoPath = join(dir, 'screen.webm')
  shell.showItemInFolder(existsSync(videoPath) ? videoPath : dir)
}

/**
 * media:// 协议：URL 形如 media://rec/<sessionId>/<file>，仅放行 recordings 根目录内文件。
 * 需要在 app ready 前配套 registerSchemesAsPrivileged（stream: true）。
 *
 * 实现方式：protocol.handle + 手写 Range 响应，body 用内存 Buffer（不走流）。
 * 实测 Electron 39 的坑：registerFileProtocol 与 net.fetch(file://) 都不产出 206；
 * 改用手写 206 + ReadableStream body 后，Chrome demuxer 对某些文件在收到响应头后
 * 零数据直接取消请求（Format error，时序敏感）；Buffer body 响应最普通，兼容性最好。
 * Range 切片一般很小；整文件请求一次读入内存（预览/导出会话文件均为几十 MB 量级）。
 */
export function registerMediaProtocol(): void {
  protocol.handle('media', async (request) => {
    const url = new URL(request.url)
    // URL 形如 media://rec/<sessionId>/<file>：host=rec，pathname=/<sessionId>/<file>
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '')
    const root = recordingsRoot()
    const abs = normalize(join(root, rel))
    if (abs !== root && !abs.startsWith(root + sep)) {
      return new Response('forbidden', { status: 403 })
    }
    if (!existsSync(abs)) {
      return new Response('not found', { status: 404 })
    }

    const size = statSync(abs).size
    const contentType = abs.endsWith('.webm')
      ? 'video/webm'
      : abs.endsWith('.wav')
        ? 'audio/wav'
        : 'application/octet-stream'

    const range = request.headers.get('range')
    const m = range ? /bytes=(\d*)-(\d*)/.exec(range) : null
    if (m) {
      // 支持 "bytes=start-" / "bytes=start-end" / "bytes=-suffix"
      let start = m[1] ? parseInt(m[1], 10) : 0
      let end = m[2] ? parseInt(m[2], 10) : size - 1
      if (!m[1] && m[2]) {
        start = Math.max(0, size - parseInt(m[2], 10))
        end = size - 1
      }
      if (start >= size || start > end) {
        return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
      }
      end = Math.min(end, size - 1)
      const len = end - start + 1
      const buf = Buffer.alloc(len)
      const fh = await open(abs, 'r')
      try {
        await fh.read(buf, 0, len, start)
      } finally {
        await fh.close()
      }
      return new Response(buf, {
        status: 206,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(len),
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Accept-Ranges': 'bytes'
        }
      })
    }

    const buf = await readFile(abs)
    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(size),
        'Accept-Ranges': 'bytes'
      }
    })
  })
}
