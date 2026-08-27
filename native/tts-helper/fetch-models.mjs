/**
 * 内置 TTS 模型获取（挂 npm run build:native）：
 * 按 shared/ttsModels.json 清单把 bundled 模型目录准备到 native/tts-helper/models/：
 * 1. 模型目录缺失时下载 archiveUrl（GitHub tts-models release tar.bz2）并解压；
 * 2. 逐个校验 extraFiles（压缩包内是 Git LFS 指针的文件），不符则从 url 下载真身替换；
 * 3. 校验清单声明的所有核心模型文件大小 + SHA-1，并检查词典/FST/数据目录；
 * 4. 清理已明确下线的旧官方 VITS 模型目录。
 * 校验失败抛错终止（与 whisper fetch-models 语义一致，Release 缺模型即失败）。
 */
import { createHash } from 'node:crypto'
import { createReadStream, existsSync, mkdirSync, rmSync, statSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const manifest = require('../../shared/ttsModels.json')

const here = dirname(fileURLToPath(import.meta.url))
const modelsRoot = join(here, 'models')
mkdirSync(modelsRoot, { recursive: true })

async function sha1Of(path) {
  const hash = createHash('sha1')
  await new Promise((resolve, reject) => {
    const stream = createReadStream(path)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', resolve)
    stream.on('error', reject)
  })
  return hash.digest('hex')
}

async function download(url, target, expectedSize, expectedSha1, label) {
  console.log(`tts-models: 下载 ${label}\n  ${url}`)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`下载 ${label} 失败：HTTP ${response.status}`)
  await writeFile(target, Buffer.from(await response.arrayBuffer()))
  const size = statSync(target).size
  if (Number.isFinite(expectedSize) && size !== expectedSize) {
    throw new Error(`${label} 大小不符：期望 ${expectedSize}，实际 ${size}`)
  }
  if (expectedSha1) {
    const sha1 = await sha1Of(target)
    if (sha1 !== expectedSha1) {
      throw new Error(`${label} SHA-1 不符：期望 ${expectedSha1}，实际 ${sha1}`)
    }
  }
}

async function ensureModel(key, entry) {
  const dir = join(modelsRoot, entry.dir)

  if (!existsSync(dir)) {
    const archive = join(modelsRoot, `${entry.dir}.tar.bz2`)
    await download(entry.archiveUrl, archive, NaN, null, `${key} 模型包`)
    execFileSync('tar', ['-xjf', archive, '-C', modelsRoot], { stdio: 'inherit' })
    rmSync(archive, { force: true })
  }

  for (const [file, extra] of Object.entries(entry.extraFiles ?? {})) {
    const path = join(dir, file)
    const ok = existsSync(path) &&
      statSync(path).size === extra.size &&
      (await sha1Of(path)) === extra.sha1
    if (!ok) await download(extra.url, path, extra.size, extra.sha1, `${key}/${file}`)
  }

  let totalSize = 0
  for (const [file, expected] of Object.entries(entry.requiredFiles)) {
    const path = join(dir, file)
    if (!existsSync(path)) throw new Error(`tts-models: ${entry.dir}/${file} 不存在`)
    const size = statSync(path).size
    if (size !== expected.size) throw new Error(`${file} 大小不符：期望 ${expected.size}，实际 ${size}`)
    const sha1 = await sha1Of(path)
    if (sha1 !== expected.sha1) throw new Error(`${file} SHA-1 不符：期望 ${expected.sha1}，实际 ${sha1}`)
    totalSize += size
  }
  const structural = [entry.tokens, ...(entry.lexicons ?? []), ...(entry.ruleFsts ?? [])]
  if (entry.dataDir) structural.push(entry.dataDir)
  for (const file of structural) {
    if (!existsSync(join(dir, file))) throw new Error(`tts-models: ${entry.dir}/${file} 不存在`)
  }
  console.log(`tts-models: ${entry.dir} 就绪（${(totalSize / 1024 / 1024).toFixed(1)}MB）`)
}

// 旧官方 VITS 已下线；只清理明确的遗留目录，绝不影响用户自定义模型。
for (const legacy of ['vits-melo-tts-zh_en', 'vits-zh-hf-theresa', 'vits-zh-hf-fanchen-C']) {
  rmSync(join(modelsRoot, legacy), { recursive: true, force: true })
}

for (const [key, entry] of Object.entries(manifest.models)) {
  const bundled = manifest.voices.some((v) => v.model === key && v.bundled)
  if (bundled) await ensureModel(key, entry)
}
