import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'

/**
 * 自定义 VITS 模型导入时使用的流式 SHA-1。官方模型只在构建期下载，
 * 不再保留应用运行时下载能力。
 */

export async function sha1File(path: string): Promise<string> {
  const hash = createHash('sha1')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}
