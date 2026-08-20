/** worker 上下文入口：probe = 采样探针；full = 完整 runExport 离线导出（与生产同路径） */
import { runContextProbe } from './probe-body'
import { runExport } from '../../src/export/pipeline'
import type { ExportStartMessage } from '../../src/export/messages'

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<unknown>) => void) | null
  postMessage(msg: unknown, transfer?: Transferable[]): void
}

scope.onmessage = async (e) => {
  const msg = e.data as
    | { type: 'probe'; videoUrl: string }
    | ({ type: 'full' } & Omit<ExportStartMessage, 'type'>)
  try {
    if (msg.type === 'probe') {
      scope.postMessage({ kind: 'probe', result: await runContextProbe(msg.videoUrl) })
      return
    }
    const result = await runExport({ ...msg, type: 'start' }, (done, total) => {
      scope.postMessage({ kind: 'progress', done, total })
    })
    scope.postMessage({ kind: 'full', result }, [result.buffer])
  } catch (err) {
    scope.postMessage({ kind: 'fatal', message: err instanceof Error ? err.message : String(err) })
  }
}
