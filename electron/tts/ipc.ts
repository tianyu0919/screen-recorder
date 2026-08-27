import { dialog, ipcMain, type BrowserWindow } from 'electron'
import { IPC } from '../../shared/ipc'
import type { TtsGenerateRequest, TtsLanguage } from '../../shared/tts'
import { ttsService } from './service'

/** TTS 配音 IPC 注册（kr-08，仿 transcription 注册段）；状态事件转发到渲染进程。 */
export function registerTtsIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle(IPC.TtsVoices, () => ttsService.listVoices())
  ipcMain.handle(IPC.TtsGet, (_e, sessionId: string) => ttsService.snapshot(sessionId))
  ipcMain.handle(IPC.TtsGenerate, (_e, request: TtsGenerateRequest) => ttsService.start(request))
  ipcMain.handle(IPC.TtsCancel, (_e, sessionId: string) => ttsService.cancel(sessionId))
  ipcMain.handle(IPC.TtsPreviewVoice, (_e, voiceId: string, language: TtsLanguage) =>
    ttsService.previewVoice(voiceId, language)
  )
  // 自定义模型是目录（含 .onnx + tokens.txt），用目录选择框；用户取消返回 null
  ipcMain.handle(IPC.TtsImportModel, async () => {
    const win = getWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
    const dir = result.filePaths[0]
    if (result.canceled || !dir) return null
    return ttsService.importModel(dir)
  })
  ipcMain.handle(IPC.TtsDeleteModel, (_e, modelKey: string) => ttsService.deleteModel(modelKey))
  ttsService.onStatus((status) => {
    const win = getWindow()
    if (win && !win.isDestroyed()) win.webContents.send(IPC.TtsStatusChanged, status)
  })
}
