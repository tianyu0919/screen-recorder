import { create } from 'zustand'
import type { ExportFormat } from '@shared/types'
import type { ExportStartMessage, ExportWorkerMessage } from '@/export/messages'

export type ExportTaskStatus = 'queued' | 'exporting' | 'done' | 'error'

export interface ExportTask {
  id: string
  sessionId: string
  name: string
  status: ExportTaskStatus
  progress: number
  destinationDir?: string
  message: ExportStartMessage
  resultPath: string | null
  outputFormat: ExportFormat | null
  hasAudio: boolean
  outputSize: { width: number; height: number } | null
  errorMessage: string | null
  createdAt: number
  completedAt?: number
}

interface ExportState {
  tasks: ExportTask[]
  activeTaskId: string | null
  activityRevision: number
  activityVisible: boolean
  enqueueExport(message: ExportStartMessage, directory?: string): void
  enqueueExportToDirectory(message: ExportStartMessage): Promise<void>
  cancelTask(id: string): void
  dismissTask(id: string): void
  dismissAll(): void
  revealActivity(): void
}

let activeWorker: Worker | null = null

export const useExportStore = create<ExportState>((set, get) => ({
  tasks: [], activeTaskId: null, activityRevision: 0, activityVisible: false,
  enqueueExport(snapshot, directory) {
    const hadBackgroundWork = get().tasks.some(
      (item) => item.status === 'queued' || item.status === 'exporting'
    )
    const task: ExportTask = {
      id: crypto.randomUUID(), sessionId: snapshot.sessionId, name: snapshot.sessionName,
      status: 'queued', progress: 0, destinationDir: directory, message: snapshot,
      resultPath: null, outputFormat: null, hasAudio: false, outputSize: null,
      errorMessage: null, createdAt: Date.now()
    }
    set({
      tasks: [...get().tasks, task],
      activityVisible: hadBackgroundWork ? get().activityVisible : false
    })
    queueMicrotask(pumpQueue)
  },
  async enqueueExportToDirectory(message) {
    const directory = await window.api.chooseExportDirectory()
    if (directory) get().enqueueExport(message, directory)
  },
  cancelTask(id) {
    if (get().activeTaskId === id) {
      activeWorker?.terminate()
      activeWorker = null
      const tasks = get().tasks.filter((task) => task.id !== id)
      set({ activeTaskId: null, tasks, activityVisible: tasks.length > 0 && get().activityVisible })
      queueMicrotask(pumpQueue)
      return
    }
    const tasks = get().tasks.filter((task) => task.id !== id)
    set({ tasks, activityVisible: tasks.length > 0 && get().activityVisible })
  },
  dismissTask(id) {
    const tasks = get().tasks.filter((task) => task.id !== id)
    set({ tasks, activityVisible: tasks.length > 0 && get().activityVisible })
  },
  dismissAll() {
    if (get().activeTaskId) return
    set({ tasks: [], activityVisible: false })
  },
  revealActivity() {
    const state = get()
    if (state.activityVisible || !state.tasks.some(
      (task) => task.status === 'queued' || task.status === 'exporting'
    )) return
    set({ activityVisible: true, activityRevision: state.activityRevision + 1 })
  }
}))

useExportStore.subscribe((state, previous) => {
  const busy = state.tasks.some((task) => task.status === 'queued' || task.status === 'exporting')
  const wasBusy = previous.tasks.some((task) => task.status === 'queued' || task.status === 'exporting')
  if (busy !== wasBusy) void window.api.setExportBusy(busy)
})

function updateTask(id: string, patch: Partial<ExportTask>): void {
  useExportStore.setState((state) => ({
    tasks: state.tasks.map((task) => task.id === id ? { ...task, ...patch } : task)
  }))
}

function finishTask(id: string, patch: Partial<ExportTask>): void {
  activeWorker = null
  useExportStore.setState((state) => ({
    activeTaskId: null,
    tasks: state.tasks.map((task) => task.id === id
      ? { ...task, ...patch, completedAt: Date.now() } : task)
  }))
  queueMicrotask(pumpQueue)
}

function pumpQueue(): void {
  const state = useExportStore.getState()
  if (state.activeTaskId) return
  const task = state.tasks.find((item) => item.status === 'queued')
  if (!task) return
  const worker = new Worker(new URL('../export/worker.ts', import.meta.url), { type: 'module' })
  activeWorker = worker
  useExportStore.setState({ activeTaskId: task.id })
  updateTask(task.id, { status: 'exporting', progress: 0 })
  worker.onmessage = (event: MessageEvent<ExportWorkerMessage>) => {
    if (useExportStore.getState().activeTaskId !== task.id) return
    const message = event.data
    if (message.type === 'progress') {
      updateTask(task.id, {
        progress: message.total > 0 ? message.done / message.total : 0,
        ...(message.outputWidth && message.outputHeight
          ? { outputSize: { width: message.outputWidth, height: message.outputHeight } } : {})
      })
      return
    }
    worker.terminate()
    if (message.type === 'error') {
      finishTask(task.id, { status: 'error', errorMessage: message.message })
      return
    }
    void window.api.saveExport(
      task.sessionId, task.name, message.buffer, message.format, task.destinationDir
    )
      .then((saved) => finishTask(task.id, {
        status: 'done', progress: 1, resultPath: saved?.path ?? null,
        outputFormat: message.format, hasAudio: message.audio,
        outputSize: { width: message.outputWidth, height: message.outputHeight }
      }))
      .catch((error: unknown) => finishTask(task.id, {
        status: 'error', errorMessage: `保存失败：${error instanceof Error ? error.message : String(error)}`
      }))
  }
  worker.onerror = () => {
    if (useExportStore.getState().activeTaskId !== task.id) return
    worker.terminate()
    finishTask(task.id, { status: 'error', errorMessage: '导出线程异常终止' })
  }
  worker.postMessage(task.message)
}
