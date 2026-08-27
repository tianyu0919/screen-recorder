/**
 * tts-helper 构建分发（由 native/build.mjs 按平台调用）：
 * - darwin / win32：下载 sherpa-onnx 官方预编译包（shared），cmake 编译 src/main.cpp，
 *   产物与运行时库一起放到 native/tts-helper/bin/<platform>/
 * - 其他平台：跳过（分发层返回 null，静默降级）
 * 设置 LENZA_REQUIRE_TTS_HELPER=1 时任何一步失败都直接抛错（Release 用）。
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SHERPA_ONNX_VERSION = 'v1.12.20'

const here = dirname(fileURLToPath(import.meta.url))
const vendor = join(here, 'vendor')
const build = join(vendor, `build-${process.platform}-${process.arch}`)
const output = join(here, 'bin', process.platform)
const required = process.env.LENZA_REQUIRE_TTS_HELPER === '1'

const PACKAGE = {
  darwin: `sherpa-onnx-${SHERPA_ONNX_VERSION}-osx-universal2-shared`,
  win32: `sherpa-onnx-${SHERPA_ONNX_VERSION}-win-x64-shared`
}[process.platform]

function fail(message) {
  if (required) throw new Error(message)
  console.warn(message)
  process.exit(0)
}

if (!PACKAGE) {
  console.log(`tts-helper: ${process.platform} 无预编译包，跳过`)
  process.exit(0)
}

const pkgDir = join(vendor, PACKAGE)
if (!existsSync(pkgDir)) {
  mkdirSync(vendor, { recursive: true })
  const url = `https://github.com/k2-fsa/sherpa-onnx/releases/download/${SHERPA_ONNX_VERSION}/${PACKAGE}.tar.bz2`
  const archive = join(vendor, `${PACKAGE}.tar.bz2`)
  console.log(`tts-helper: 下载 ${url}`)
  const response = await fetch(url)
  if (!response.ok) fail(`下载 sherpa-onnx ${SHERPA_ONNX_VERSION} 失败：HTTP ${response.status}`)
  writeFileSync(archive, Buffer.from(await response.arrayBuffer()))
  execFileSync('tar', ['-xjf', archive, '-C', vendor], { stdio: 'inherit' })
  rmSync(archive, { force: true })
}

mkdirSync(output, { recursive: true })
const exeName = process.platform === 'win32' ? 'tts-helper.exe' : 'tts-helper'
const target = join(output, exeName)

if (process.platform === 'darwin') {
  // 单翻译单元直接用 clang++（Xcode CLT 自带），不强依赖 cmake
  if (spawnSync('clang++', ['--version'], { stdio: 'ignore' }).status !== 0) {
    fail('tts-helper: 未找到 clang++（Xcode 命令行工具），跳过 TTS helper')
  }
  execFileSync('clang++', [
    '-std=c++17', '-O2',
    join(here, 'src/main.cpp'),
    join(here, 'src/json_protocol.cpp'),
    '-I', join(pkgDir, 'include'),
    '-L', join(pkgDir, 'lib'),
    '-lsherpa-onnx-c-api',
    '-Wl,-rpath,@executable_path',
    '-o', target
  ], { stdio: 'inherit' })
} else {
  const cmake = findCmake()
  if (spawnSync(cmake, ['--version'], { stdio: 'ignore' }).status !== 0) {
    fail('tts-helper: 未找到 cmake，跳过 TTS helper；安装 CMake 后重跑 npm run build:native')
  }
  rmSync(build, { recursive: true, force: true })
  execFileSync(cmake, [
    '-S', here,
    '-B', build,
    '-DCMAKE_BUILD_TYPE=Release',
    `-DSHERPA_ONNX_DIR=${pkgDir}`
  ], { stdio: 'inherit' })
  execFileSync(cmake, ['--build', build, '--config', 'Release', '--parallel'], { stdio: 'inherit' })
  const binary = [join(build, exeName), join(build, 'Release', exeName)].find(existsSync)
  if (!binary) fail('tts-helper: 构建成功但未找到可执行产物')
  copyFileSync(binary, target)
}

// 运行时库与可执行文件同目录（macOS rpath=@executable_path；Windows 按 DLL 搜索顺序）
// 只拷 c-api 及其依赖（cxx-api 用不到，不拷以控制体积）
if (process.platform === 'darwin') {
  for (const name of readdirSync(join(pkgDir, 'lib'))) {
    // 跳过符号链接（如 libonnxruntime.dylib → 版本化真身），避免 48MB 重复拷贝
    if (lstatSync(join(pkgDir, 'lib', name)).isSymbolicLink()) continue
    if (/^lib(onnxruntime|sherpa-onnx-c-api)[^/]*\.dylib$/.test(name)) {
      copyFileSync(join(pkgDir, 'lib', name), join(output, name))
    }
  }
  chmodSync(join(output, exeName), 0o755)
} else {
  for (const dir of [join(pkgDir, 'bin'), join(pkgDir, 'lib')]) {
    if (!existsSync(dir)) continue
    for (const name of readdirSync(dir)) {
      if (name.endsWith('.dll') && !name.includes('cxx-api')) {
        copyFileSync(join(dir, name), join(output, name))
      }
    }
  }
}
console.log(`built: native/tts-helper/bin/${process.platform}/${exeName}`.replace(/\\/g, '/'))

function findCmake() {
  if (process.platform !== 'win32') return 'cmake'
  const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files'
  for (const version of ['18', '2022']) {
    for (const edition of ['Community', 'Professional', 'Enterprise', 'BuildTools']) {
      const candidate = join(
        programFiles, 'Microsoft Visual Studio', version, edition,
        'Common7', 'IDE', 'CommonExtensions', 'Microsoft', 'CMake', 'CMake', 'bin', 'cmake.exe'
      )
      if (existsSync(candidate)) return candidate
    }
  }
  return 'cmake'
}
