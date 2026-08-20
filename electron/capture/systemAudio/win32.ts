import { spawnSystemAudioHelper, type StopSystemAudio } from './helper'

export type { StopSystemAudio }

/**
 * Windows 系统音频采集（kr-01 system-audio）：
 * getDisplayMedia loopback + MediaRecorder 路径在 Windows 上有杂音（Chromium 回环
 * 采样率不匹配爆音 + 默认低码率 Opus 失真），改 spawn Rust helper（native/wasapi-audio）
 * 走 WASAPI shared-mode loopback 直采 PCM，落盘 48kHz/2ch/int16 WAV；
 * VB-Audio 虚拟设备（Voicemeeter/VB-Cable）用户由 helper 内自动绕行总线采集端点。
 * helper 不存在 / 启动失败 → 返回 null 静默降级（不阻断录制）。
 * 进程管理逻辑与 macOS 共用 ./helper.ts，此处只声明 Windows 的 helper 产物位置。
 */
export function startSystemAudioCapture(wavPath: string): StopSystemAudio | null {
  return spawnSystemAudioHelper(
    {
      binName: 'wasapi-audio.exe',
      devBinPath: 'native/wasapi-audio/bin/wasapi-audio.exe',
      tag: '[wasapi-audio]'
    },
    wavPath
  )
}
