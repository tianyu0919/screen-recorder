import type { CameraKeyframe } from '@shared/types'

/**
 * 关键帧 → 运镜片段（zoom>1 的连续区间）。
 * 密集点击合并运镜时一个片段含多个 zoom-in 关键帧（片段起始 = 首个关键帧时间）。
 * 时间轴渲染与 previewStore 的片段倍率覆盖共用同一份合并规则，保证"点选的块 =
 * 被覆盖的块"。endMs 由调用方给：UI 传会话时长，覆盖匹配传 Infinity。
 */
export interface ZoomSegment {
  startMs: number
  endMs: number
  zoom: number
}

export function buildZoomSegments(keyframes: CameraKeyframe[], endMs: number): ZoomSegment[] {
  const segments: ZoomSegment[] = []
  let open: ZoomSegment | null = null
  for (const kf of keyframes) {
    if (kf.target.zoom > 1.05) {
      if (!open) {
        if (kf.t < endMs) open = { startMs: kf.t, endMs, zoom: kf.target.zoom }
      } else {
        open.zoom = kf.target.zoom
      }
    } else if (open) {
      // 回归帧可能排在视频结束之后（末次点击 + dwell），钳到时间轴长度内
      open.endMs = Math.min(kf.t, endMs)
      if (open.endMs > open.startMs) segments.push(open)
      open = null
    }
  }
  if (open && open.endMs > open.startMs) segments.push(open)
  return segments
}
