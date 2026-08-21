/** 时间轴刻度与时间码的纯工具（PlayerTimeline 用） */

/** ms → "mm:ss" 时间码 */
export function formatMs(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, '0')
  const s = (total % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

/** 刻度间隔取"好看"的整秒值：保证相邻刻度像素间距 >= minPx */
export function pickTickIntervalSec(pxPerSec: number, minPx = 56): number {
  const candidates = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900]
  for (const c of candidates) {
    if (c * pxPerSec >= minPx) return c
  }
  return 900
}
