import type { PlatformTtsHelperConfig } from './helper'

// macOS 分发配置：打包后 helper 与 dylib 同目录在 resourcesPath/tts-helper/，
// 开发期直接用 native/tts-helper/bin/darwin/ 下的构建产物（实现见 helper.ts）。
export const HELPER_CONFIG: PlatformTtsHelperConfig = {
  binName: 'tts-helper',
  devPath: 'native/tts-helper/bin/darwin/tts-helper'
}
