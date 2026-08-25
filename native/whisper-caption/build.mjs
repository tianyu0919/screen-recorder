import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const VERSION = 'v1.9.0'
const here = dirname(fileURLToPath(import.meta.url))
const vendor = join(here, 'vendor')
const source = join(vendor, `whisper.cpp-${VERSION.slice(1)}`)
const archive = join(vendor, `${VERSION}.tar.gz`)
const build = join(vendor, `build-${process.platform}-${process.arch}`)
const output = join(here, 'bin', process.platform)
const required = process.env.LENZA_REQUIRE_CAPTION_HELPER === '1'

if (spawnSync('cmake', ['--version'], { stdio: 'ignore' }).status !== 0) {
  const message = 'whisper-caption: 未找到 cmake，跳过字幕 helper；安装 CMake 后重跑 npm run build:native'
  if (required) throw new Error(message)
  console.warn(message)
  process.exit(0)
}

mkdirSync(vendor, { recursive: true })
if (!existsSync(source)) {
  const response = await fetch(`https://github.com/ggml-org/whisper.cpp/archive/refs/tags/${VERSION}.tar.gz`)
  if (!response.ok) throw new Error(`下载 whisper.cpp ${VERSION} 失败：HTTP ${response.status}`)
  writeFileSync(archive, Buffer.from(await response.arrayBuffer()))
  execFileSync('tar', ['-xzf', archive, '-C', vendor], { stdio: 'inherit' })
  rmSync(archive, { force: true })
}

rmSync(build, { recursive: true, force: true })
execFileSync('cmake', [
  '-S', source,
  '-B', build,
  '-DCMAKE_BUILD_TYPE=Release',
  '-DBUILD_SHARED_LIBS=OFF',
  '-DWHISPER_BUILD_TESTS=OFF',
  '-DWHISPER_BUILD_SERVER=OFF'
], { stdio: 'inherit' })
execFileSync('cmake', ['--build', build, '--config', 'Release', '--target', 'whisper-cli', '--parallel'], {
  stdio: 'inherit'
})

mkdirSync(output, { recursive: true })
const candidates = [
  join(build, 'bin', 'whisper-cli'),
  join(build, 'bin', 'Release', 'whisper-cli.exe'),
  join(build, 'bin', 'whisper-cli.exe')
]
const binary = candidates.find(existsSync)
if (!binary) throw new Error('whisper.cpp 构建成功但未找到 whisper-cli 产物')
const target = join(output, process.platform === 'win32' ? 'whisper-caption.exe' : 'whisper-caption')
copyFileSync(binary, target)
if (process.platform !== 'win32') chmodSync(target, 0o755)

if (process.platform === 'win32') {
  for (const dir of [join(build, 'bin'), join(build, 'bin', 'Release')]) {
    if (!existsSync(dir)) continue
    for (const name of readdirSync(dir)) {
      if (name.endsWith('.dll')) copyFileSync(join(dir, name), join(output, name))
    }
  }
}
console.log(`built: native/whisper-caption/bin/${process.platform}/${target.split(/[\\/]/).pop()}`)
