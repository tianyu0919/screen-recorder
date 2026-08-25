export const SESSION_DISPLAY_NAME_MAX_LENGTH = 80

const INVALID_FILE_NAME = /[<>:"/\\|?*\u0000-\u001f]/
const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i

export function validateSessionDisplayName(value: string): string | null {
  const normalized = value.trim()
  if (!normalized) return '录像名称不能为空'
  if (normalized.length > SESSION_DISPLAY_NAME_MAX_LENGTH) {
    return `录像名称不能超过 ${SESSION_DISPLAY_NAME_MAX_LENGTH} 个字符`
  }
  if (INVALID_FILE_NAME.test(normalized)) return '录像名称不能包含 < > : " / \\ | ? * 或控制字符'
  if (normalized.endsWith('.')) return '录像名称不能以句点结尾'
  if (WINDOWS_RESERVED_NAME.test(normalized)) return '该名称是系统保留名称，请更换后重试'
  return null
}

export function normalizeSessionDisplayName(value: string): string {
  const error = validateSessionDisplayName(value)
  if (error) throw new Error(error)
  return value.trim()
}
