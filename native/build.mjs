/**
 * 原生系统音频 helper 构建分发（npm run build:native）：
 * - darwin：native/sck-audio（swiftc，需 macOS + Swift 工具链）
 * - win32：native/wasapi-audio（cargo build --release，需 Rust 工具链）
 * - 其他平台：无需构建，直接跳过
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

if (process.platform === 'darwin') {
  execFileSync('bash', [join(root, 'native/sck-audio/build.sh')], { stdio: 'inherit' })
} else if (process.platform === 'win32') {
  const crateDir = join(root, 'native/wasapi-audio')
  execFileSync('cargo', ['build', '--release'], { cwd: crateDir, stdio: 'inherit' })
  mkdirSync(join(crateDir, 'bin'), { recursive: true })
  copyFileSync(
    join(crateDir, 'target/release/wasapi-audio.exe'),
    join(crateDir, 'bin/wasapi-audio.exe')
  )
  console.log('built: native/wasapi-audio/bin/wasapi-audio.exe')
} else {
  console.log(`build:native: ${process.platform} 无原生 helper，跳过`)
}
