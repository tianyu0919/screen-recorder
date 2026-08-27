import type { PlatformTtsHelperConfig } from './helper'

// Windows 分发配置：打包后 tts-helper.exe 与 dll 同目录在 resourcesPath/tts-helper/，
// 开发期用 native/tts-helper/bin/win32/ 下的构建产物（实现见 helper.ts）。
export const HELPER_CONFIG: PlatformTtsHelperConfig = {
  binName: 'tts-helper.exe',
  devPath: 'native/tts-helper/bin/win32/tts-helper.exe'
}
