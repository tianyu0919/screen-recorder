import { spawnSystemAudioHelper, type StopSystemAudio } from './helper'

export type { StopSystemAudio }

/**
 * macOS 系统音频采集（kr-01 system-audio）：
 * getDisplayMedia loopback 在 macOS 上是坏的（electron#52738：音轨出生即 ended、电平恒 0），
 * 改 spawn Swift helper（native/sck-audio）走 ScreenCaptureKit 全系统音频回采，落盘 WAV。
 * helper 不存在 / 启动失败 → 返回 null 静默降级（不阻断录制）。
 * 进程管理逻辑与 Windows 共用 ./helper.ts，此处只声明 mac 的 helper 产物位置。
 */
export function startSystemAudioCapture(wavPath: string): StopSystemAudio | null {
  return spawnSystemAudioHelper(
    {
      binName: 'sck-audio',
      devBinPath: 'native/sck-audio/bin/sck-audio',
      tag: '[sck-audio]'
    },
    wavPath
  )
}
