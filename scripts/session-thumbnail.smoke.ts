/**
 * 会话缩略图与增量批次纯逻辑冒烟：
 *   TSX_TSCONFIG_PATH=tsconfig.web.json npx -y tsx scripts/session-thumbnail.smoke.ts
 */
import {
  isWebp,
  matchesThumbnailSource,
  MAX_THUMBNAIL_BYTES,
  normalizeThumbnailDuration,
  type ThumbnailMetadata
} from '../electron/store/sessionThumbnailData'
import { INITIAL_SESSION_COUNT, nextSessionCount } from '../src/lib/sessionBatch'

let failures = 0
function check(name: string, condition: boolean): void {
  if (condition) console.log(`ok   ${name}`)
  else { failures += 1; console.error(`FAIL ${name}`) }
}

const webp = new Uint8Array(12)
webp.set([...'RIFF'].map((char) => char.charCodeAt(0)), 0)
webp.set([...'WEBP'].map((char) => char.charCodeAt(0)), 8)
check('WebP 文件头识别', isWebp(webp))
webp[8] = 0
check('非法图片头被拒绝', !isWebp(webp))
check('时长归一到正整数毫秒', normalizeThumbnailDuration(1234.6) === 1235)
check('非法时长降级 null', normalizeThumbnailDuration(Infinity) === null)

const metadata: ThumbnailMetadata = {
  version: 1, sessionId: 'rec-1', durationMs: 1000,
  sourceSize: 200, sourceMtimeMs: 300, updatedAt: new Date().toISOString()
}
check('源指纹匹配时缓存有效', matchesThumbnailSource(metadata, 'rec-1', { size: 200, mtimeMs: 300 }, 20_000))
check('源大小变化使缓存失效', !matchesThumbnailSource(metadata, 'rec-1', { size: 201, mtimeMs: 300 }, 20_000))
check('异常大缩略图被拒绝', !matchesThumbnailSource(metadata, 'rec-1', { size: 200, mtimeMs: 300 }, MAX_THUMBNAIL_BYTES + 1))

check('首屏批次固定为 20', INITIAL_SESSION_COUNT === 20)
check('滚动按批追加', nextSessionCount(20, 100) === 40)
check('尾批不超过总数', nextSessionCount(40, 47) === 47)

console.log(failures === 0 ? '\n全部通过' : `\n${failures} 项失败`)
process.exit(failures === 0 ? 0 : 1)
