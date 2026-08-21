const MODIFIERS = new Set(['CTRL', 'ALT', 'SHIFT', 'META'])
const FUNCTION_KEYS = new Set([
  'ENTER', 'TAB', 'ESC', 'ESCAPE', 'SPACE', 'BACKSPACE', 'DELETE', 'INSERT',
  'HOME', 'END', 'PAGEUP', 'PAGEDOWN', 'ARROWUP', 'ARROWDOWN', 'ARROWLEFT',
  'ARROWRIGHT', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'CAPSLOCK', 'NUMLOCK',
  'SCROLLLOCK', 'PRINTSCREEN'
])
for (let index = 1; index <= 24; index++) FUNCTION_KEYS.add(`F${index}`)

const ALIASES: Record<string, string> = {
  CONTROL: 'CTRL', CONTROLLEFT: 'CTRL', CONTROLRIGHT: 'CTRL',
  CTRLLEFT: 'CTRL', CTRLRIGHT: 'CTRL', ALTLEFT: 'ALT', ALTRIGHT: 'ALT',
  SHIFTLEFT: 'SHIFT', SHIFTRIGHT: 'SHIFT', METALEFT: 'META', METARIGHT: 'META',
  WIN: 'META', WINDOWS: 'META', COMMAND: 'META', RETURN: 'ENTER'
}

export const MODIFIER_ORDER = ['CTRL', 'ALT', 'SHIFT', 'META'] as const

export function normalizeKeyName(key: string): string {
  const compact = key.replace(/[\s_-]/g, '').toUpperCase()
  return ALIASES[compact] ?? compact
}

export function isModifierKey(key: string): boolean {
  return MODIFIERS.has(normalizeKeyName(key))
}

export function isFunctionKey(key: string): boolean {
  return FUNCTION_KEYS.has(normalizeKeyName(key))
}

export function isAllowedKeyPrompt(keys: string[]): boolean {
  const normalized = keys.map(normalizeKeyName).filter(Boolean)
  return normalized.length > 0 && (
    normalized.some((key) => MODIFIERS.has(key)) ||
    normalized.every((key) => FUNCTION_KEYS.has(key))
  )
}
