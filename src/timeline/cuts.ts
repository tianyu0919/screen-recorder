/**
 * 裁剪（非破坏式）：cuts 为"丢弃区间"列表（源时间轴 ms），原始 events.json/视频不动，
 * 预览播放跳过这些区间，导出按"源时间轴 - 裁剪区间"的输出时间轴渲染。
 * 本文件为纯函数：区间归一化与 源↔输出 时间换算，预览（usePlayback）与
 * 导出（export/pipeline）共用，保证两条链路行为一致。
 */

export interface CutRange {
  startMs: number
  endMs: number
}

/** 排序 + 合并重叠/相邻区间 + 钳制到 [0, maxMs] */
export function normalizeCuts(cuts: CutRange[], maxMs = Infinity): CutRange[] {
  const sorted = cuts
    .map((c) => ({
      startMs: Math.max(0, Math.min(c.startMs, c.endMs)),
      endMs: Math.min(maxMs, Math.max(c.startMs, c.endMs))
    }))
    .filter((c) => c.endMs - c.startMs > 0)
    .sort((a, b) => a.startMs - b.startMs)
  const merged: CutRange[] = []
  for (const c of sorted) {
    const last = merged[merged.length - 1]
    if (last && c.startMs <= last.endMs) last.endMs = Math.max(last.endMs, c.endMs)
    else merged.push({ ...c })
  }
  return merged
}

/** tMs 落在某裁剪区间内时返回该区间结束点（跳过目标），否则 null */
export function cutEndAt(tMs: number, cuts: CutRange[]): number | null {
  for (const c of cuts) {
    if (tMs >= c.startMs && tMs < c.endMs) return c.endMs
    if (tMs < c.startMs) break
  }
  return null
}

/** tMs 所在的裁剪区间（无则 null） */
export function cutAt(tMs: number, cuts: CutRange[]): CutRange | null {
  for (const c of cuts) {
    if (tMs >= c.startMs && tMs < c.endMs) return c
    if (tMs < c.startMs) break
  }
  return null
}

/** 输出时长 = 源时长 - 裁剪区间总长（至少 1ms） */
export function effectiveDurationMs(durationMs: number, cuts: CutRange[]): number {
  const removed = cuts.reduce((acc, c) => acc + (c.endMs - c.startMs), 0)
  return Math.max(1, durationMs - removed)
}

/** 源时间 → 输出时间（裁剪区间内的点映射到区间起点对应的输出位置） */
export function sourceToOutputMs(tMs: number, cuts: CutRange[]): number {
  let removed = 0
  for (const c of cuts) {
    if (tMs <= c.startMs) break
    removed += Math.min(tMs, c.endMs) - c.startMs
  }
  return tMs - removed
}

/** 输出时间 → 源时间（导出逐帧渲染时求源帧位置） */
export function outputToSourceMs(oMs: number, cuts: CutRange[]): number {
  let acc = 0
  let prev = 0
  for (const c of cuts) {
    const keptLen = c.startMs - prev
    if (oMs < acc + keptLen) return prev + (oMs - acc)
    acc += keptLen
    prev = c.endMs
  }
  return prev + (oMs - acc)
}
