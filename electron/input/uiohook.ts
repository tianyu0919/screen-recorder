import type { ClickEvent, KeyEvent } from '../../shared/types'
import {
  isFunctionKey,
  isModifierKey,
  MODIFIER_ORDER,
  normalizeKeyName
} from '../../shared/keyEvents'

/**
 * 全局输入钩子（Task 3.2）：基于 uiohook-napi 采集 mousedown 与 keydown。
 * （uiohook-nap 已被作者更名为 uiohook-napi；N-API 预编译，Electron 下免 rebuild）
 * 加载失败（缺权限/原生库异常）时降级：
 * available=false，录制继续但无点击/键盘事件（spec 降级路径）。
 */

type UiohookModule = typeof import('uiohook-napi')

/** uiohook 按键码 → 名归一化（构建一次反向映射） */
function buildKeyNameMap(mod: UiohookModule): Map<number, string> {
  const map = new Map<number, string>()
  for (const [name, code] of Object.entries(mod.UiohookKey)) {
    if (typeof code === 'number' && !map.has(code)) map.set(code, name)
  }
  return map
}

/** uiohook 鼠标按键号 → 契约 button（1=左 2=中 3=右） */
function mapButton(b: number): 1 | 2 | 3 {
  if (b === 1) return 1
  if (b === 3) return 2 // uiohook: 3=middle
  return 3 // uiohook: 2=right
}

export class InputHook {
  available = false
  unavailableReason = ''
  private mod: UiohookModule | null = null
  private keyNames: Map<number, string> = new Map()
  private t0 = 0
  private recording = false
  private clicks: ClickEvent[] = []
  private keys: KeyEvent[] = []
  private modifiers = new Map<string, { t: number; used: boolean }>()
  private lastKey: { label: string; t: number } | null = null

  private pushKey(t: number, parts: string[]): void {
    const label = parts.join('+')
    if (this.lastKey?.label === label && t - this.lastKey.t < 250) return
    this.keys.push({ t, key: label })
    this.lastKey = { label, t }
  }

  /** 加载原生模块并注册监听；失败则降级，不抛错 */
  async init(): Promise<void> {
    if (this.mod) {
      this.available = true
      return
    }
    try {
      const mod = (await import('uiohook-napi')) as UiohookModule
      this.mod = mod
      this.keyNames = buildKeyNameMap(mod)
      mod.uIOhook.on('mousedown', (e) => {
        if (!this.recording) return
        this.clicks.push({
          t: Date.now() - this.t0,
          x: Math.round(e.x),
          y: Math.round(e.y),
          button: mapButton(e.button as number)
        })
      })
      mod.uIOhook.on('keydown', (e) => {
        if (!this.recording) return
        const t = Date.now() - this.t0
        const key = normalizeKeyName(this.keyNames.get(e.keycode) ?? `Key${e.keycode}`)
        if (isModifierKey(key)) {
          if (!this.modifiers.has(key)) this.modifiers.set(key, { t, used: false })
          return
        }
        const eventModifiers = new Set<string>()
        if (e.ctrlKey) eventModifiers.add('CTRL')
        if (e.altKey) eventModifiers.add('ALT')
        if (e.shiftKey) eventModifiers.add('SHIFT')
        if (e.metaKey) eventModifiers.add('META')
        const active = MODIFIER_ORDER.filter(
          (modifier) => this.modifiers.has(modifier) || eventModifiers.has(modifier)
        )
        if (active.length === 0 && !isFunctionKey(key)) return
        for (const modifier of active) {
          const state = this.modifiers.get(modifier)
          if (state) state.used = true
        }
        this.pushKey(t, [...active, key])
      })
      mod.uIOhook.on('keyup', (e) => {
        if (!this.recording) return
        const key = normalizeKeyName(this.keyNames.get(e.keycode) ?? `Key${e.keycode}`)
        if (!isModifierKey(key)) return
        const state = this.modifiers.get(key)
        if (state && !state.used) this.pushKey(state.t, [key])
        this.modifiers.delete(key)
      })
      mod.uIOhook.start()
      this.available = true
    } catch (err) {
      this.available = false
      this.unavailableReason = err instanceof Error ? err.message : String(err)
      this.mod = null
    }
  }

  startRecording(t0: number): void {
    this.clicks = []
    this.keys = []
    this.modifiers.clear()
    this.lastKey = null
    this.t0 = t0
    this.recording = this.available
  }

  stopRecording(): void {
    for (const [key, state] of this.modifiers) {
      if (!state.used) this.pushKey(state.t, [key])
    }
    this.modifiers.clear()
    this.recording = false
  }

  getClicks(): ClickEvent[] {
    return this.clicks
  }

  getKeys(): KeyEvent[] {
    return this.keys
  }

  dispose(): void {
    this.recording = false
    this.modifiers.clear()
    try {
      this.mod?.uIOhook.stop()
    } catch {
      // 忽略停止失败
    }
  }
}
