import { create } from 'zustand'
import type { CameraKeyframe, RecordingSession } from '@shared/types'
import { parseEventsJson, TimelineParseError, type Timeline } from '@/timeline/types'
import {
  DEFAULT_MOTION_PARAMS,
  generateCameraKeyframes,
  type MotionParams
} from '@/timeline/keyframes'
import { displayToCanvas } from '@/timeline/coords'
import type { RipplePoint } from '@/render/types'

/**
 * 预览状态（kr-02 Phase 3, Task 3.3）：
 * 会话列表 → 选会话加载 events.json + 视频 → 构建 Timeline → 按 MotionParams 生成关键帧。
 * 关键帧/波纹点是由 timeline + 参数派生的数据，参数修改即时重算，播放器经 props 生效。
 */

interface PreviewSession {
  session: RecordingSession
  timeline: Timeline
  videoUrl: string
}

interface PreviewState {
  sessions: RecordingSession[]
  sessionsLoaded: boolean
  loading: boolean
  /** 友好错误提示（events.json 损坏/不兼容、视频缺失等），不暴露原始堆栈 */
  loadError: string | null
  current: PreviewSession | null
  motionParams: MotionParams
  keyframes: CameraKeyframe[]
  /** 点击波纹触发点（画布坐标，合成器 drawFrame 的 clicks 入参） */
  ripples: RipplePoint[]

  loadSessions(): Promise<void>
  openSession(sessionId: string): Promise<void>
  closeSession(): void
  setMotionParams(patch: Partial<MotionParams>): void
}

/** timeline + 参数 → 关键帧与波纹点（纯派生，参数调整时重算） */
function derive(
  timeline: Timeline,
  params: MotionParams
): { keyframes: CameraKeyframe[]; ripples: RipplePoint[] } {
  return {
    keyframes: generateCameraKeyframes(timeline.events, timeline.canvas, params),
    ripples: timeline.events.clicks.map((c) => ({
      t: c.t,
      ...displayToCanvas(timeline.events.display, c.x, c.y)
    }))
  }
}

export const usePreviewStore = create<PreviewState>((set, get) => ({
  sessions: [],
  sessionsLoaded: false,
  loading: false,
  loadError: null,
  current: null,
  motionParams: DEFAULT_MOTION_PARAMS,
  keyframes: [],
  ripples: [],

  async loadSessions() {
    const sessions = await window.api.listSessions()
    set({ sessions, sessionsLoaded: true })
  },

  async openSession(sessionId) {
    set({ loading: true, loadError: null })
    try {
      const result = await window.api.loadSession(sessionId)
      const timeline = parseEventsJson(result.eventsJson)
      const current: PreviewSession = {
        session: result.session,
        timeline,
        videoUrl: result.videoUrl
      }
      set({ loading: false, current, ...derive(timeline, get().motionParams) })
    } catch (err) {
      // 损坏/版本不兼容：友好提示且不进入预览（current 保持 null）
      set({
        loading: false,
        current: null,
        loadError:
          err instanceof TimelineParseError
            ? err.message
            : `无法加载会话: ${err instanceof Error ? err.message : String(err)}`
      })
    }
  },

  closeSession() {
    set({ current: null, keyframes: [], ripples: [], loadError: null })
  },

  setMotionParams(patch) {
    const motionParams = { ...get().motionParams, ...patch }
    const { current } = get()
    // 改参数即时重新生成关键帧；播放器经 keyframes 引用变化重置 animator 并重绘
    set(current ? { motionParams, ...derive(current.timeline, motionParams) } : { motionParams })
  }
}))
