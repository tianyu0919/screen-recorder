/**
 * 下载内置字幕模型（Whisper Small + Silero VAD）到 native/whisper-caption/models/，
 * 供开发模式直接使用，并由 electron-builder extraResources 打包进 resourcesPath/whisper-models/。
 * 清单唯一来源：shared/captionModels.json（大小 + sha1 校验，原子落盘，已存在且合法则跳过）。
 */
import { createHash } from 'node:crypto'
import { createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs'
import { readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const manifest = JSON.parse(await readFile(join(root, 'shared', 'captionModels.json'), 'utf8'))
const outDir = join(root, 'native', 'whisper-caption', 'models')
const required = process.env.LENZA_REQUIRE_CAPTION_HELPER === '1'
const targets = [manifest.builtin, manifest.vad]

mkdirSync(outDir, { recursive: true })
for (const model of targets) {
  const target = join(outDir, model.file)
  if (isValid(target, model)) {
    console.log(`ok: ${model.file} 已存在且校验通过，跳过下载`)
    continue
  }
  try {
    await download(model, target)
    console.log(`fetched: native/whisper-caption/models/${model.file} (${Math.round(model.size / 1024 / 1024)}MB)`)
  } catch (error) {
    const message = `whisper-caption 模型下载失败（${model.file}）：${error instanceof Error ? error.message : error}`
    if (required) throw new Error(message)
    console.warn(`${message}；开发模式生成字幕后置不可用，联网后重跑 npm run build:native`)
  }
}

// huggingface.co 在部分网络环境不可达，依次尝试镜像；也可用 LENZA_HF_ENDPOINT 覆盖
function downloadUrls(model) {
  const urls = [model.url]
  if (process.env.LENZA_HF_ENDPOINT) urls.unshift(model.url.replace('https://huggingface.co', process.env.LENZA_HF_ENDPOINT))
  urls.push(model.url.replace('https://huggingface.co', 'https://hf-mirror.com'))
  return [...new Set(urls)]
}

function isValid(path, model) {
  return existsSync(path) && statSync(path).size === model.size
}

async function download(model, target) {
  const temporary = `${target}.${process.pid}.download`
  await rm(temporary, { force: true })
  let lastError
  for (const url of downloadUrls(model)) {
    try {
      await downloadFrom(url, model, temporary)
      await rename(temporary, target)
      await writeFile(`${target}.sha1`, model.sha1, 'utf8')
      return
    } catch (error) {
      lastError = error
      console.warn(`  ${model.file} 从 ${new URL(url).host} 下载失败：${error instanceof Error ? error.message : error}`)
      await rm(temporary, { force: true }).catch(() => {})
    }
  }
  throw lastError
}

async function downloadFrom(url, model, temporary) {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)
  const total = Number(response.headers.get('content-length')) || model.size
  const hash = createHash('sha1')
  const file = createWriteStream(temporary, { flags: 'wx' })
  const reader = response.body.getReader()
  let received = 0
  let reported = -1
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      hash.update(value)
      received += value.byteLength
      if (!file.write(value)) await new Promise((resolve) => file.once('drain', resolve))
      const percent = Math.floor((received / total) * 100 / 10) * 10
      if (percent !== reported) { reported = percent; console.log(`  ${model.file} ${percent}%`) }
    }
    await new Promise((resolve, reject) => file.end((error) => error ? reject(error) : resolve()))
  } catch (error) {
    file.destroy()
    throw error
  }
  if (received !== model.size) throw new Error(`大小不符：期望 ${model.size}，实际 ${received}`)
  if (hash.digest('hex') !== model.sha1) throw new Error('sha1 校验失败')
}
