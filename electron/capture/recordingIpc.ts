import { ipcMain, type BrowserWindow } from 'electron'
import { join } from 'node:path'
import { IPC } from '../../shared/ipc'
import type {
  ActivateRecordingResult,
  PrepareRecordingResult,
  RecordingError,
  StartRecordingPayload
} from '../../shared/types'
import { CursorPoller } from '../input/cursorPoller'
import { InputHook } from '../input/uiohook'
import { SessionStore } from '../store/sessionStore'
import { updateService } from '../updater'
import {
  activateRecordingContext,
  buildSessionEvents,
  resolveRecordingContext,
  type RecordingContext
} from './recordingContext'
import { startSystemAudioCapture, type StopSystemAudio } from './systemAudio'

const POLL_HZ = 90

/** 录制 IPC 生命周期：prepare 冻结画布，activate 才启动所有时间轴。 */
export function registerRecordingIpc(getWindow: () => BrowserWindow | null): InputHook {
  const poller = new CursorPoller()
  const inputHook = new InputHook()
  const sendError = (code: RecordingError['code'], message: string): void => {
    getWindow()?.webContents.send(IPC.RecordingError, { code, message } satisfies RecordingError)
  }
  const store = new SessionStore((code, message) => sendError(code, message))

  let t0 = 0
  let videoMeta: StartRecordingPayload['video'] | null = null
  let stopSystemAudio: StopSystemAudio | null = null
  let recordingCtx: RecordingContext | null = null

  const reset = (): void => {
    t0 = 0
    videoMeta = null
    recordingCtx = null
    stopSystemAudio = null
  }

  ipcMain.handle(IPC.RecordingStart, async (_event, payload: StartRecordingPayload) => {
    if (store.hasActiveSession()) throw new Error('已有进行中的录制会话')
    await inputHook.init()
    const session = store.startSession()
    try {
      videoMeta = payload.video
      recordingCtx = await resolveRecordingContext(payload.sourceId)
      return {
        sessionId: session.sessionId,
        display: recordingCtx.displayInfo,
        source: recordingCtx.source,
        fixedCanvas: recordingCtx.fixedCanvas ?? undefined
      } satisfies PrepareRecordingResult
    } catch (error) {
      await store.abort()
      reset()
      throw error
    }
  })

  ipcMain.handle(IPC.RecordingActivate, () => {
    const sessionDir = store.getSessionDir()
    if (!sessionDir || !recordingCtx || !videoMeta) throw new Error('录制会话尚未准备完成')
    if (t0 > 0) throw new Error('录制会话已启动')

    t0 = Date.now()
    recordingCtx = activateRecordingContext(recordingCtx, t0)
    stopSystemAudio = startSystemAudioCapture(join(sessionDir, 'system.wav'))
    poller.start(POLL_HZ, t0)
    inputHook.startRecording(t0)
    updateService.setRecording(true)

    return {
      startTime: t0,
      inputHookAvailable: inputHook.available,
      inputHookError: inputHook.available ? undefined : inputHook.unavailableReason
    } satisfies ActivateRecordingResult
  })

  ipcMain.handle(IPC.RecordingWriteChunk, (_event, chunk: ArrayBuffer) => {
    store.writeChunk(Buffer.from(chunk))
  })
  ipcMain.handle(IPC.RecordingWriteMic, (_event, wav: ArrayBuffer) => {
    store.writeMic(Buffer.from(wav))
  })
  ipcMain.handle(IPC.RecordingWriteSystemAudio, (_event, wav: ArrayBuffer) => {
    store.writeSystemAudio(Buffer.from(wav))
  })

  ipcMain.handle(IPC.RecordingStop, async () => {
    poller.stop()
    inputHook.stopRecording()
    await stopSystemAudio?.()
    const windowGeometry = recordingCtx?.geometrySession
      ? await recordingCtx.geometrySession.stop()
      : []
    updateService.setRecording(false)
    if (!store.hasActiveSession() || !videoMeta || !recordingCtx || t0 <= 0) {
      await store.abort()
      reset()
      return null
    }

    const events = buildSessionEvents(recordingCtx, t0, videoMeta, windowGeometry, {
      mouseTrack: poller.getTrack(),
      clicks: inputHook.getClicks(),
      keys: inputHook.getKeys()
    })
    try {
      const result = await store.finalize(events)
      getWindow()?.webContents.send(IPC.RecordingStopped, result)
      return result
    } catch (error) {
      await store.abort()
      throw error
    } finally {
      reset()
    }
  })

  ipcMain.handle('recording:abort', async () => {
    poller.stop()
    inputHook.stopRecording()
    await stopSystemAudio?.()
    await recordingCtx?.geometrySession?.stop()
    await store.abort()
    updateService.setRecording(false)
    reset()
  })

  return inputHook
}
