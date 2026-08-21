/**
 * 发版说明生成器：读取 .github/RELEASE_TEMPLATE.md，用当前 tag、上一个 tag、
 * 区间内的 conventional commits 填充，输出 RELEASE_NOTES.md（CI 供 action-gh-release 引用）。
 *
 * 分类约定（commit message 前缀）：
 *   feat → 新增；fix / perf / revert → 修复；其余（含无前缀）→ 其他变更。
 *
 * 用法：node scripts/release-notes.mjs [tag]
 *   不传 tag 时取 GITHUB_REF_NAME，再退化为 package.json version。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const tag =
  process.argv[2] ?? process.env.GITHUB_REF_NAME ?? `v${pkg.version}`

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
}

function refExists(ref) {
  try {
    git('rev-parse', '--verify', `${ref}^{commit}`)
    return true
  } catch {
    return false
  }
}

// CI 里 tag 必然存在；本地预览时 tag 可能不存在，退化为 HEAD
const tagRef = refExists(tag) ? tag : 'HEAD'

// 上一个 tag（首个版本时为空 → 提交范围 = 全部历史）
let prevTag = ''
try {
  prevTag = git('describe', '--tags', '--abbrev=0', `${tagRef}^`)
} catch {
  /* 没有更早的 tag */
}

const range = prevTag ? `${prevTag}..${tagRef}` : tagRef
const logOutput = git('log', '--no-merges', '--pretty=%s', range)
const commits = logOutput ? logOutput.split('\n').filter(Boolean) : []

const added = []
const fixed = []
const others = []
for (const c of commits) {
  const m = c.match(/^(\w+)(\(.*?\))?!?:\s*(.+)$/)
  const type = m?.[1]?.toLowerCase() ?? ''
  const text = m ? m[3] : c
  if (type === 'feat') added.push(text)
  else if (['fix', 'perf', 'revert'].includes(type)) fixed.push(text)
  else others.push(text)
}

const list = (arr) => (arr.length > 0 ? arr.map((t) => `- ${t}`).join('\n') : '- 无')

const remote = git('config', '--get', 'remote.origin.url')
  .replace(/\.git$/, '')
  .replace(/^git@github\.com:/, 'https://github.com/')
const compareUrl = prevTag
  ? `${remote}/compare/${prevTag}...${tag}`
  : `${remote}/releases/tag/${tag}`

const body = readFileSync('.github/RELEASE_TEMPLATE.md', 'utf8')
  .replaceAll('{{VERSION}}', tag)
  // 产物文件名跟 package.json version（无 v 前缀），标题/比较链接用 tag（带 v）
  .replaceAll('{{APP_VERSION}}', tag.replace(/^v/, ''))
  .replaceAll('{{PREV_VERSION}}', prevTag || '（首个版本）')
  .replaceAll('{{DATE}}', new Date().toISOString().slice(0, 10))
  .replaceAll('{{ADDED}}', list(added))
  .replaceAll('{{FIXED}}', list(fixed))
  .replaceAll('{{OTHERS}}', list(others))
  .replaceAll('{{COMPARE_URL}}', compareUrl)

writeFileSync('RELEASE_NOTES.md', body)
console.log(
  `[release-notes] ${prevTag || '(首个版本)'} -> ${tag}：新增 ${added.length} / 修复 ${fixed.length} / 其他 ${others.length}`
)
