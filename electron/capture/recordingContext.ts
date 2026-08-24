import { desktopCapturer, screen } from 'electron'
import type { RecordingEvents, StartRecordingPayload } from '../../shared/types'
import type {
  AnyRecordingEvents,
  RecordingEventsV2,
  WindowGeometrySample
} from '../../shared/eventsV2'
import { startWindowGeometryCapture, type WindowGeometrySession } from './windowGeometry'

/**
 * 录制上下文（kr-01 window-capture-fixed-canvas，从 ipc.ts 拆出以满足单文件行数上限）：
 * 开始录制时解析来源类型、被录源所在显示器与（窗口来源的）固定画布 + 几何采样会话；
 * 停止时按来源组装 events.json（窗口 V2 / 整屏 V1）。
 */

export interface RecordingContext {
  source: { type: 'screen' | 'window'; id: string }
  displayInfo: RecordingEvents['display']
  /** 窗口录制冻结的固定画布（物理像素，偶数化）；screen 来源为 null */
  fixedCanvas: { width: number; height: number } | null
  /** 窗口几何采样会话；screen 来源或 helper 不可用时为 null */
  geometrySession: WindowGeometrySession | null
}

const even = (n: number): number => Math.max(2, Math.floor(n / 2) * 2)

export async function resolveRecordingContext(
  sourceId: string
): Promise<RecordingContext> {
  const sourceType: 'screen' | 'window' = sourceId.startsWith('window') ? 'window' : 'screen'
  let disp = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  let fixedCanvas: RecordingContext['fixedCanvas'] = null
  const geometrySession: WindowGeometrySession | null = null

  if (sourceType === 'screen') {
    // screen 源按 desktopCapturer 的 display_id 精确匹配
    const screenSources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 0, height: 0 }
    })
    const matched = screenSources.find((s) => s.id === sourceId)
    const byDisplayId = screen
      .getAllDisplays()
      .find((d) => matched !== undefined && String(d.id) === matched.display_id)
    if (byDisplayId) disp = byDisplayId
  } else {
    // window 源无 display_id：几何 helper 首样本定位窗口所在显示器，回退光标所在显示器
    const probe = startWindowGeometryCapture(sourceId, Date.now())
    const first = (await probe?.firstSample(500)) ?? null
    await probe?.stop()
    if (first) {
      disp = screen.getDisplayMatching({
        x: first[1],
        y: first[2],
        width: first[3],
        height: first[4]
      })
    }
    fixedCanvas = {
      width: even(Math.round(disp.size.width * disp.scaleFactor)),
      height: even(Math.round(disp.size.height * disp.scaleFactor))
    }
  }

  return {
    source: { type: sourceType, id: sourceId },
    displayInfo: {
      id: disp.id,
      bounds: [disp.bounds.x, disp.bounds.y, disp.bounds.width, disp.bounds.height],
      scaleFactor: disp.scaleFactor
    },
    fixedCanvas,
    geometrySession
  }
}

/** MediaRecorder 已启动后才建立正式几何时间线，避免准备固定画布的耗时污染事件时间轴。 */
export function activateRecordingContext(ctx: RecordingContext, t0: number): RecordingContext {
  if (ctx.source.type !== 'window') return ctx
  return { ...ctx, geometrySession: startWindowGeometryCapture(ctx.source.id, t0) }
}

/**
 * 组装 events.json：窗口录制写 V2（固定画布 + 几何时间线，视频尺寸即固定画布）；
 * 整屏录制保持 V1 不变。
 */
export function buildSessionEvents(
  ctx: RecordingContext,
  t0: number,
  videoMeta: StartRecordingPayload['video'],
  windowGeometry: WindowGeometrySample[],
  events: Pick<RecordingEvents, 'mouseTrack' | 'clicks' | 'keys'>
): AnyRecordingEvents {
  if (ctx.source.type === 'window' && ctx.fixedCanvas) {
    return {
      version: 2,
      startTime: t0,
      display: ctx.displayInfo,
      source: {
        type: 'window',
        id: ctx.source.id,
        fixedCanvas: ctx.fixedCanvas,
        ...(windowGeometry.length > 0 ? { windowGeometry } : {})
      },
      video: {
        width: ctx.fixedCanvas.width,
        height: ctx.fixedCanvas.height,
        fps: videoMeta.fps,
        file: 'screen.webm'
      },
      ...events
    } satisfies RecordingEventsV2
  }
  return {
    version: 1,
    startTime: t0,
    display: ctx.displayInfo,
    video: { ...videoMeta, file: 'screen.webm' },
    ...events
  } satisfies RecordingEvents
}
