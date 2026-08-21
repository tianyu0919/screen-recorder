import type { ManualKeyPrompt } from '@shared/edit'
import type { KeyEvent } from '@shared/types'
import {
  isAllowedKeyPrompt,
  isFunctionKey,
  isModifierKey,
  normalizeKeyName
} from '@shared/keyEvents'

export interface DisplayKeyPrompt {
  id: string
  t: number
  keys: string[]
  source: 'recorded' | 'manual'
  sourceIndices: number[]
}

export { isAllowedKeyPrompt, isFunctionKey, isModifierKey, normalizeKeyName }

function splitStoredCombo(key: string): string[] {
  return key
    .split('+')
    .map(normalizeKeyName)
    .filter(Boolean)
}

/** 兼容旧 keys：隐藏普通输入，把 450ms 内的修饰键序列组合成快捷键。 */
export function deriveRecordedKeyPrompts(
  events: KeyEvent[],
  hiddenIndices: number[] = []
): DisplayKeyPrompt[] {
  const hidden = new Set(hiddenIndices)
  const prompts: DisplayKeyPrompt[] = []
  for (let index = 0; index < events.length; index++) {
    if (hidden.has(index)) continue
    const current = events[index]
    const storedCombo = splitStoredCombo(current.key)
    if (storedCombo.length > 1 && isAllowedKeyPrompt(storedCombo)) {
      prompts.push({
        id: `recorded-key-${index}`,
        t: current.t,
        keys: storedCombo,
        source: 'recorded',
        sourceIndices: [index]
      })
      continue
    }
    const key = storedCombo[0]
    if (!key) continue
    if (isModifierKey(key)) {
      const keys = [key]
      const indices = [index]
      let cursor = index + 1
      while (cursor < events.length && events[cursor].t - current.t <= 450) {
        const next = normalizeKeyName(events[cursor].key)
        if (!next) break
        if (isModifierKey(next)) {
          if (!keys.includes(next)) keys.push(next)
          indices.push(cursor)
          cursor++
          continue
        }
        keys.push(next)
        indices.push(cursor)
        index = cursor
        break
      }
      if (isAllowedKeyPrompt(keys)) {
        prompts.push({
          id: `recorded-key-${indices[0]}`,
          t: current.t,
          keys,
          source: 'recorded',
          sourceIndices: indices
        })
      }
    } else if (isFunctionKey(key)) {
      prompts.push({
        id: `recorded-key-${index}`,
        t: current.t,
        keys: [key],
        source: 'recorded',
        sourceIndices: [index]
      })
    }
  }
  return prompts
}

export function buildKeyPrompts(
  recorded: KeyEvent[],
  manual: ManualKeyPrompt[],
  hiddenIndices: number[] = []
): DisplayKeyPrompt[] {
  return [
    ...deriveRecordedKeyPrompts(recorded, hiddenIndices),
    ...manual.filter((prompt) => isAllowedKeyPrompt(prompt.keys)).map((prompt) => ({
      ...prompt,
      keys: prompt.keys.map(normalizeKeyName),
      source: 'manual' as const,
      sourceIndices: []
    }))
  ].sort((a, b) => a.t - b.t)
}

export function activeKeyPromptAt(
  prompts: DisplayKeyPrompt[],
  tMs: number,
  durationMs = 1500,
  fadeMs = 140
): { prompt: DisplayKeyPrompt; alpha: number } | null {
  let lo = 0
  let hi = prompts.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (prompts[mid].t <= tMs) {
      found = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  if (found < 0) return null
  const prompt = prompts[found]
  const age = tMs - prompt.t
  if (age >= durationMs) return null
  const fadeIn = Math.min(1, age / fadeMs)
  const fadeOut = Math.min(1, (durationMs - age) / fadeMs)
  return { prompt, alpha: Math.max(0, Math.min(fadeIn, fadeOut)) }
}
