import { startSystemAudioCapture as startDarwin, type StopSystemAudio } from './darwin'

export type { StopSystemAudio }

/**
 * 系统音频采集平台分发（kr-01 system-audio）：
 * - darwin：Main 进程 spawn 原生 helper（./darwin.ts），Renderer loopback 在 macOS 上不可用
 * - win32：走 Renderer 侧 getDisplayMedia loopback（src/recorder/screenRecorder.ts），Main 不介入
 * - 其他平台：暂不支持，静默降级
 * 注：darwin.ts 无平台相关顶层副作用，静态引入在 win32 下同样安全。
 */
export function startSystemAudioCapture(wavPath: string): StopSystemAudio | null {
  if (process.platform !== 'darwin') return null
  return startDarwin(wavPath)
}
