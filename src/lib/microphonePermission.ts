import type { PermissionStatus } from '@shared/types'

export type MicrophonePermission = PermissionStatus['microphone']
export type MicrophoneIntent = 'enable' | 'request' | 'settings'

export function microphoneIntent(permission: MicrophonePermission): MicrophoneIntent {
  if (permission === 'granted') return 'enable'
  return permission === 'unknown' ? 'request' : 'settings'
}

export function reconcileMicrophoneEnabled(
  previousPermissions: PermissionStatus | null,
  nextPermission: MicrophonePermission,
  currentlyEnabled: boolean
): boolean {
  if (nextPermission !== 'granted') return false
  return previousPermissions === null ? true : currentlyEnabled
}

export function microphoneCaptureFailed(requested: boolean, available: boolean): boolean {
  return requested && !available
}
