/** 全局快捷键不应覆盖表单、链接或按钮自身的键盘行为。 */
export function blocksGlobalShortcut(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return target.closest('input, textarea, select, button, a, [role="button"], [role="slider"]') !== null
}
