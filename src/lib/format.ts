/** 毫秒时长 → m:ss（预览列表/编辑器共用）；非法/未知时长（如未算出）显示占位符 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '--:--'
  const total = Math.round(ms / 1000)
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, '0')
  const s = (total % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** 日期标签：今天 / 昨天 / 同年 M月d日 / 跨年年月日 */
export function formatDayLabel(ts: number): string {
  const dayMs = 86400000
  const today = startOfDay(Date.now())
  const day = startOfDay(ts)
  if (day === today) return '今天'
  if (day === today - dayMs) return '昨天'
  const d = new Date(ts)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return sameYear
    ? `${d.getMonth() + 1}月${d.getDate()}日`
    : `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

/** 一天内的时间：HH:MM（24h） */
export function formatTimeOfDay(ts: number): string {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}
