import type { FixedCanvasStartMessage, FixedCanvasWorkerOut } from './fixedCanvasWorker'

/**
 * 固定画布生成轨的 Renderer 主线程封装（kr-01 window-capture-fixed-canvas，Task 3.2）：
 * 克隆源视频轨传入 Worker，换回恒定尺寸的生成轨给 MediaRecorder；
 * 原始轨留在主线程供预览 <video> 继续使用。
 */

export interface FixedCanvasTrackHandle {
  /** 恒定 fixedCanvas 尺寸的生成轨（MediaRecorder 只录这条） */
  track: MediaStreamTrack
  /** 释放 Worker、生成轨与克隆轨 */
  dispose(): void
}

export function fixedCanvasSupported(): boolean {
  // MediaStreamTrackProcessor / VideoTrackGenerator 在 Chromium 只暴露给 DedicatedWorker，
  // 主窗口线程查不到属正常；真正的能力检测在 Worker 内完成（见 fixedCanvasWorker.ts）
  return typeof Worker !== 'undefined'
}

export function createFixedCanvasTrack(
  sourceTrack: MediaStreamTrack,
  size: { width: number; height: number },
  cornerRadiusPx = 0
): Promise<FixedCanvasTrackHandle> {
  if (!fixedCanvasSupported()) {
    return Promise.reject(
      new Error('当前环境不支持窗口固定画布录制（需要 MediaStreamTrackProcessor/VideoTrackGenerator）')
    )
  }
  const worker = new Worker(new URL('./fixedCanvasWorker.ts', import.meta.url), { type: 'module' })
  const clone = sourceTrack.clone()
  return new Promise((resolve, reject) => {
    let settled = false
    const timeout = window.setTimeout(() => fail('固定画布 Worker 启动超时'), 5000)
    const fail = (message: string): void => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      try {
        clone.stop()
      } catch {
        // 轨已移交或结束
      }
      worker.terminate()
      reject(new Error(message))
    }
    worker.onmessage = (event: MessageEvent<FixedCanvasWorkerOut>) => {
      const msg = event.data
      if (msg.type === 'error') {
        fail(msg.message)
        return
      }
      if (msg.type === 'track' && !settled) {
        settled = true
        window.clearTimeout(timeout)
        resolve({
          track: msg.track,
          dispose: () => {
            try {
              msg.track.stop()
            } catch {
              // 轨已结束
            }
            try {
              clone.stop()
            } catch {
              // 轨已移交或结束
            }
            worker.terminate()
          }
        })
      }
    }
    worker.onerror = (event) => fail(event.message || '固定画布 Worker 异常')
    const start: FixedCanvasStartMessage = {
      type: 'start',
      track: clone,
      width: size.width,
      height: size.height,
      cornerRadiusPx
    }
    // MediaStreamTrack 不可 transferable（Chromium 直接拒绝），先试 transfer，
    // 失败后退回结构化克隆（按值发送，Worker 内得到克隆轨）
    try {
      worker.postMessage(start, [clone as unknown as Transferable])
      return
    } catch {
      // 继续尝试克隆方式
    }
    try {
      worker.postMessage(start)
    } catch (err) {
      fail(`采集轨无法移交 Worker: ${err instanceof Error ? err.message : String(err)}`)
    }
  })
}
