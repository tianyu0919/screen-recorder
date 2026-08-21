import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CameraKeyframe, RecordingEvents } from '@shared/types'
import { PauseIcon, PlayIcon } from '@/components/icons'
import { usePreviewStore } from '@/store/previewStore'
import { buildZoomSegments } from '@/timeline/segments'
import { effectiveDurationMs, sourceToOutputMs } from '@/timeline/cuts'
import { CutsLayer, useCutRangeSelection } from './CutsLayer'
import { formatMs, pickTickIntervalSec } from '@/timeline/ticks'
import { cn } from '@/lib/utils'

interface PlayerTimelineProps {
  playing: boolean
  currentMs: number
  durationMs: number
  keyframes: CameraKeyframe[]
  events: RecordingEvents
  onTogglePlay(): void
  onSeek(ms: number): void
}

/**
 * 底部时间轴：走带控制 + 刻度尺 + 运镜/事件双轨 + 播放头。
 * 滚轮以光标为锚点缩放时间范围（1x = 全部时长适配宽度，最大 12x），放大后可横向滚动；
 * 点击运镜片段选中（检查器可单独调倍率），点击空白处跳转播放位置。
 */
export function PlayerTimeline({
  playing,
  currentMs,
  durationMs,
  keyframes,
  events,
  onTogglePlay,
  onSeek
}: PlayerTimelineProps): React.JSX.Element {
  const { selectedSegmentT, selectSegment, cuts, addCut, removeCut } = usePreviewStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [viewportW, setViewportW] = useState(0)
  const [zoom, setZoom] = useState(1)
  const pendingAnchor = useRef<{ ratio: number; cursorX: number } | null>(null)
  /** 用户主动操作视口的接管期截止时间戳：期间不自动跟随播放头 */
  const followHoldUntil = useRef(0)
  // 刻度尺框选与选区调整（拖边/移动），状态机收敛在 CutsLayer 的 hook 里
  const contentRef = useRef<HTMLDivElement>(null)

  const duration = Math.max(1, durationMs)
  const cutSel = useCutRangeSelection(contentRef, duration)
  const pxPerSec = viewportW > 0 ? (viewportW * zoom) / (duration / 1000) : 0
  const contentWpx = viewportW * zoom
  const segments = buildZoomSegments(keyframes, duration)
  const intervalSec = pickTickIntervalSec(pxPerSec || 1)
  const ticks: number[] = []
  for (let s = 0; s * 1000 < duration; s += intervalSec) ticks.push(s)
  // 刻度策略：首(00:00)尾(总时长)固定贴边、尾标签右对齐不越界；
  // 中间刻度按缩放密度分配，与尾标签区域(约 34px)相撞的不画
  const TICK_LABEL_W = 34
  const endZoneStart = contentWpx - TICK_LABEL_W
  const endLabel = formatMs(duration)
  const middleTicks = ticks.filter((s) => {
    if (s === 0) return false
    // 与尾标签同名的刻度（如 28.0s 与总时长 28.x s 都显示 "00:28"）不画
    if (formatMs(s * 1000) === endLabel) return false
    const px = ((s * 1000) / duration) * contentWpx
    return px + TICK_LABEL_W < endZoneStart - 4
  })
  // 键帽过密时降级为圆点，避免相互覆盖（放大时间范围后仍可看清）
  const keyCaps = events.keys.length <= 40

  // 视口宽度跟踪（fit 基准）；会话切换时复位缩放
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setViewportW(el.clientWidth))
    ro.observe(el)
    setViewportW(el.clientWidth)
    return () => ro.disconnect()
  }, [])
  useEffect(() => setZoom(1), [durationMs])

  // 滚轮：纵向 = 以光标为锚点缩放（触控板捏合同理），横向 = 平移。
  // React 的 onWheel 是 passive 无法 preventDefault，需原生监听。
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault()
      followHoldUntil.current = Date.now() + 1500
      // 触控板双指横滑：平移而非缩放
      if (!e.ctrlKey && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        el.scrollLeft += e.deltaX
        return
      }
      const cursorX = e.clientX - el.getBoundingClientRect().left
      pendingAnchor.current = {
        ratio: (el.scrollLeft + cursorX) / Math.max(1, el.scrollWidth),
        cursorX
      }
      // 按滚动量连续缩放：鼠标滚轮一格 ≈ 1.22x，触控板细粒度平滑
      setZoom((z) => Math.min(12, Math.max(1, z * Math.exp(-e.deltaY * 0.002))))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // 缩放后保持光标下的时间点不漂移
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el && pendingAnchor.current) {
      el.scrollLeft = pendingAnchor.current.ratio * el.scrollWidth - pendingAnchor.current.cursorX
      pendingAnchor.current = null
    }
  }, [zoom])

  // 播放中且放大时：播放头越出死区(15%~85%)则视口缓动跟随（每帧按距离比例逼近）；
  // 用户滚轮/拖动进入 1.5s 接管期，期间不跟随，停止操作后自动恢复
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !playing || zoom <= 1) return
    if (Date.now() < followHoldUntil.current) return
    const x = (currentMs / duration) * el.scrollWidth
    const vw = el.clientWidth
    const lo = el.scrollLeft + vw * 0.15
    const hi = el.scrollLeft + vw * 0.85
    let delta = 0
    if (x < lo) delta = x - lo
    else if (x > hi) delta = x - hi
    if (delta !== 0) {
      el.scrollLeft = Math.max(0, el.scrollLeft + delta * 0.18)
    }
  }, [currentMs, playing, zoom, duration])

  // 单点 = 跳转；按住拖动 = 平移（位移超过 4px 判定为拖动）
  const panRef = useRef<{ startX: number; startScroll: number; panned: boolean } | null>(null)

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    const el = scrollRef.current
    if (!el) return
    followHoldUntil.current = Date.now() + 1500
    panRef.current = { startX: e.clientX, startScroll: el.scrollLeft, panned: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const st = panRef.current
    const el = scrollRef.current
    if (!st || !el) return
    const dx = e.clientX - st.startX
    if (!st.panned && Math.abs(dx) > 4) st.panned = true
    if (st.panned) {
      followHoldUntil.current = Date.now() + 1500
      el.scrollLeft = st.startScroll - dx
    }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>): void => {
    const st = panRef.current
    panRef.current = null
    // st 为空说明按下发生在运镜片段按钮上（已 stopPropagation 并选中片段），
    // 不能按空白单击处理，否则抬起就把选中态清掉了
    if (!st || st.panned) return
    if (durationMs === 0) return
    cutSel.setRangeSel(null)
    const rect = e.currentTarget.getBoundingClientRect()
    const r = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    const targetMs = Math.round(r * durationMs)
    selectSegment(null)
    // 点进裁剪区的吸附（中间段跳起点/尾部段回有效结尾）统一由 usePlayback.seekTo 处理
    onSeek(targetMs)
  }

  return (
    <div className="flex h-[168px] select-none flex-none flex-col border-t border-line bg-[#0e0e11]">
      <div className="flex h-10 flex-none items-center gap-3 border-b border-line px-3.5">
        <button
          onClick={onTogglePlay}
          disabled={durationMs === 0}
          aria-label={playing ? '暂停' : '播放'}
          className="grid h-[26px] w-[26px] place-items-center rounded-full bg-ink-1 text-base disabled:opacity-40"
        >
          {playing ? (
            <PauseIcon size={11} strokeWidth={2.4} />
          ) : (
            <PlayIcon size={11} strokeWidth={2.4} className="translate-x-[1px]" />
          )}
        </button>
        <span className="font-mono text-[12.5px] text-ink-1" title={cuts.length > 0 ? '已按裁剪后时长计算' : undefined}>
          {formatMs(sourceToOutputMs(currentMs, cuts))}{' '}
          <span className="text-ink-3">/ {formatMs(effectiveDurationMs(durationMs, cuts))}</span>
        </span>
        <span className="flex-1" />
        {zoom > 1 && (
          <button
            onClick={() => setZoom(1)}
            className="rounded-md border border-line bg-surface-2 px-2 py-0.5 font-mono text-[10.5px] text-ink-2 hover:text-ink-1"
            title="复位时间范围"
          >
            {Math.round(zoom * 100)}%
          </button>
        )}
        <span className="text-[10.5px] text-ink-3">滚轮缩放 · 拖动平移 · 刻度尺框选裁剪</span>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex w-[62px] flex-none flex-col border-r border-line pt-[22px] text-[10.5px] text-ink-3">
          <span className="flex h-[42px] items-center justify-center">运镜</span>
          <span className="flex h-[42px] items-center justify-center">事件</span>
        </div>

        <div
          ref={scrollRef}
          className="no-scrollbar min-w-0 flex-1 overflow-x-auto overflow-y-hidden"
        >
          <div
            ref={contentRef}
            className="relative h-full"
            // 首帧测量完成前回退 100% 宽，避免内容被压成 1px 不可见
            style={{
              width: viewportW > 0 ? `${Math.round(contentWpx)}px` : '100%'
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <div
              className="relative h-[22px] cursor-crosshair border-b border-line"
              onPointerDown={cutSel.beginDrag('create')}
              onPointerMove={cutSel.onDragMove}
              onPointerUp={cutSel.onDragEnd}
            >
              {/* 首刻度：贴左缘 */}
              <span className="absolute left-0 top-0 h-full border-l border-line-strong" />
              <span className="absolute left-0 top-0 pl-1 font-mono text-[9.5px] leading-[22px] text-ink-3">
                00:00
              </span>
              {/* 中间刻度：按缩放密度分配 */}
              {middleTicks.map((s) => (
                <span key={s}>
                  <span
                    className="absolute top-0 h-full border-l border-line-strong"
                    style={{ left: `${((s * 1000) / duration) * 100}%` }}
                  />
                  <span
                    className="absolute top-0 pl-1 font-mono text-[9.5px] leading-[22px] text-ink-3"
                    style={{ left: `${((s * 1000) / duration) * 100}%` }}
                  >
                    {formatMs(s * 1000)}
                  </span>
                </span>
              ))}
              {/* 尾刻度：贴右缘、右对齐不越界 */}
              <span className="absolute right-0 top-0 h-full border-r border-line-strong" />
              <span className="absolute right-0 top-0 pr-1 font-mono text-[9.5px] leading-[22px] text-ink-3">
                {endLabel}
              </span>
            </div>

            <CutsLayer
              cuts={cuts}
              duration={duration}
              rangeSel={cutSel.rangeSel}
              sel={cutSel}
              onCommit={() => {
                if (cutSel.rangeSel) addCut(cutSel.rangeSel)
                cutSel.setRangeSel(null)
              }}
              onDiscard={() => cutSel.setRangeSel(null)}
              onEditCut={(range, i) => {
                // 退回可编辑选区：先撤出 cuts（画面恢复显示），用户调整后重新确认或关闭
                removeCut(i)
                cutSel.setRangeSel(range)
              }}
            />

            <div className="relative h-[42px] border-b border-[rgba(255,255,255,0.04)]">
              {segments.map((seg) => {
                const left = (seg.startMs / duration) * 100
                const width = Math.max(0.8, ((seg.endMs - seg.startMs) / duration) * 100)
                const selected = seg.startMs === selectedSegmentT
                return (
                  <button
                    key={seg.startMs}
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      selectSegment(seg.startMs)
                      onSeek(seg.startMs)
                    }}
                    className={cn(
                      'absolute top-[9px] flex h-6 items-center justify-center rounded-md border font-mono text-[10.5px]',
                      selected
                        ? 'border-accent bg-[rgba(255,92,56,0.24)] text-[#ffd9cc] shadow-[0_0_0_2px_rgba(255,92,56,0.18)]'
                        : 'border-[rgba(255,92,56,0.3)] bg-accent-soft text-[#ffb59f] hover:border-accent-border'
                    )}
                    style={{ left: `${left}%`, width: `${width}%` }}
                  >
                    {((width / 100) * pxPerSec * (duration / 1000) > 44 || selected) &&
                      `${seg.zoom.toFixed(1)}x`}
                  </button>
                )
              })}
            </div>

            <div className="relative h-[42px]">
              {events.clicks.map((c, i) => (
                <span
                  key={`c${i}`}
                  className="absolute top-1/2 h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#8e8e96]"
                  style={{ left: `${(c.t / duration) * 100}%` }}
                />
              ))}
              {events.keys.map((k, i) =>
                keyCaps ? (
                  <span
                    key={`k${i}`}
                    className="absolute top-1/2 flex h-4 -translate-x-1/2 -translate-y-1/2 items-center rounded border border-line-strong bg-surface-3 px-1 font-mono text-[9px] text-ink-2"
                    style={{ left: `${(k.t / duration) * 100}%` }}
                  >
                    {k.key.slice(0, 5)}
                  </span>
                ) : (
                  <span
                    key={`k${i}`}
                    className="absolute top-1/2 h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink-3"
                    style={{ left: `${(k.t / duration) * 100}%` }}
                  />
                )
              )}
            </div>

            <div
              className="pointer-events-none absolute bottom-0 top-0 w-[1.5px] bg-accent"
              style={{ left: `${Math.min(1, currentMs / duration) * 100}%` }}
            >
              <span className="absolute left-1/2 top-0 -translate-x-1/2 border-x-[5.5px] border-t-[7px] border-x-transparent border-t-accent" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
