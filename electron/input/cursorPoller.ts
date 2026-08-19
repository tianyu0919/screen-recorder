import { screen } from 'electron'

/**
 * 鼠标轨迹轮询器（Task 3.1）：
 * 以 60–120Hz 调用 screen.getCursorScreenPoint()，记录 [t, x, y]，
 * 时间戳相对录制开始（ms）。显示器拓扑变化（拔插副屏）时不中断。
 */
export class CursorPoller {
  private timer: NodeJS.Timeout | null = null
  private track: Array<[number, number, number]> = []
  private t0 = 0

  start(hz: number, t0: number): void {
    this.stop()
    this.track = []
    this.t0 = t0
    const interval = Math.max(1, Math.round(1000 / hz))
    this.timer = setInterval(() => {
      try {
        const p = screen.getCursorScreenPoint()
        this.track.push([Date.now() - this.t0, Math.round(p.x), Math.round(p.y)])
      } catch {
        // 显示器拓扑瞬时变化（拔插显示器）时轮询可能抛错：跳过该采样，录制不中断
      }
    }, interval)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  getTrack(): Array<[number, number, number]> {
    return this.track
  }
}
