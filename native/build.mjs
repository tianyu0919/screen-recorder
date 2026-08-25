/**
 * 原生 helper 构建分发（npm run build:native）：
 * - darwin：native/sck-audio（系统音频）+ native/window-geometry/darwin（窗口几何采样），
 *   均为 swiftc，需 macOS + Swift 工具链
 * - win32：native/wasapi-audio（系统音频）+ native/window-geometry/win32（窗口几何采样），
 *   均为 cargo build --release，需 Rust 工具链
 * - 其他平台：无需构建，直接跳过
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const geometryOnly = process.argv.includes('--geometry-only')

function buildCargoCrate(crateDir, exeName) {
  execFileSync('cargo', ['build', '--release'], { cwd: crateDir, stdio: 'inherit' })
  mkdirSync(join(crateDir, 'bin'), { recursive: true })
  copyFileSync(
    join(crateDir, `target/release/${exeName}.exe`),
    join(crateDir, `bin/${exeName}.exe`)
  )
  console.log(`built: ${crateDir.replace(root, '')}/bin/${exeName}.exe`.replace(/\\/g, '/'))
}

if (process.platform === 'darwin') {
  if (!geometryOnly) {
    execFileSync('bash', [join(root, 'native/sck-audio/build.sh')], { stdio: 'inherit' })
  }
  execFileSync('bash', [join(root, 'native/window-geometry/darwin/build.sh')], { stdio: 'inherit' })
} else if (process.platform === 'win32') {
  if (!geometryOnly) {
    buildCargoCrate(join(root, 'native/wasapi-audio'), 'wasapi-audio')
  }
  buildCargoCrate(join(root, 'native/window-geometry/win32'), 'window-geometry')
} else {
  console.log(`build:native: ${process.platform} 无原生 helper，跳过`)
}
