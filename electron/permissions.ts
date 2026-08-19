import { shell, systemPreferences } from 'electron'
import type { PermissionStatus } from '../shared/types'

type Level = PermissionStatus['screen']

function mac(
  status: 'granted' | 'denied' | 'restricted' | 'not-determined' | 'unknown'
): Level {
  return status === 'granted' ? 'granted' : status === 'denied' || status === 'restricted' ? 'denied' : 'unknown'
}

/** 权限状态探测（Task 2.4；非 macOS 平台视为 granted） */
export function getPermissionStatus(): PermissionStatus {
  if (process.platform !== 'darwin') {
    return { screen: 'granted', accessibility: 'granted', microphone: 'granted' }
  }
  return {
    screen: mac(systemPreferences.getMediaAccessStatus('screen')),
    accessibility: systemPreferences.isTrustedAccessibilityClient(false) ? 'granted' : 'denied',
    microphone: mac(systemPreferences.getMediaAccessStatus('microphone'))
  }
}

/** 请求麦克风权限（macOS 上会触发系统弹窗） */
export async function requestMicrophoneAccess(): Promise<boolean> {
  if (process.platform !== 'darwin') return true
  return systemPreferences.askForMediaAccess('microphone')
}

/** 跳转系统设置对应面板 */
export async function openSystemSettings(kind: 'screen' | 'accessibility' | 'microphone'): Promise<void> {
  if (process.platform !== 'darwin') return
  const pane =
    kind === 'screen'
      ? 'Privacy_ScreenCapture'
      : kind === 'accessibility'
        ? 'Privacy_Accessibility'
        : 'Privacy_Microphone'
  await shell.openExternal(`x-apple.systempreferences:com.apple.preference.security?${pane}`)
}
