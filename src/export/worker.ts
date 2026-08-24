import { ExportError } from './decoder'
import type { ExportStartMessage, ExportWorkerMessage } from './messages'
import { runExport } from './pipeline'

/**
 * 导出 Worker 入口（Task 1.1）：
 * 接收 start 消息后跑离线渲染管线；进度/完成/错误经 postMessage 回 Renderer。
 * 取消由 Renderer 直接 terminate() 完成（输出全程在内存，无半成品文件）。
 */

// DOM lib 下 self 是 Window 类型，Worker 全局的 postMessage/onmessage 签名需收窄
const scope = self as unknown as {
  postMessage(message: ExportWorkerMessage, transfer?: Transferable[]): void
  onmessage: ((event: MessageEvent<ExportStartMessage>) => void) | null
}

scope.onmessage = (event) => {
  const msg = event.data
  if (msg.type !== 'start') return
  runExport(msg, (done, total, output) => scope.postMessage({
    type: 'progress', done, total,
    ...(output ? { outputWidth: output.width, outputHeight: output.height } : {})
  }))
    .then((result) => {
      scope.postMessage({ type: 'done', ...result }, [result.buffer])
    })
    .catch((err: unknown) => {
      const message =
        err instanceof ExportError
          ? err.message
          : `导出失败: ${err instanceof Error ? err.message : String(err)}`
      scope.postMessage({ type: 'error', message })
    })
}
