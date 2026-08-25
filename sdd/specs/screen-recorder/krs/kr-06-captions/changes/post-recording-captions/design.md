# Design: 录制后离线字幕生成与编辑

## 1. Architecture

```mermaid
flowchart LR
  Editor[编辑页 · 生成字幕] --> IPC[白名单 IPC]
  IPC --> Jobs[Main 转写任务管理器]
  Jobs --> Model[Whisper + VAD 下载/校验]
  Jobs --> Helper[darwin/win32 whisper.cpp helper]
  WAV[mic.wav] --> Helper
  Helper --> Atomic[原子写 captions.json]
  Atomic --> Store[字幕 Store + 时间轴编辑]
  Store --> Render[统一字幕位图合成]
  Render --> Preview[编辑/专注预览]
  Render --> MP4[烧录 MP4]
  Store --> SRT[裁剪后 SRT]
```

- Renderer 只发起任务、展示状态和编辑字幕，不直接加载模型或执行推理。
- Main 以 `sessionId` 为键维护单实例任务；关闭字幕、显式取消、删除会话或退出应用会终止任务。
- `electron/transcription/index.ts` 只做平台分发；`darwin.ts`、`win32.ts` 管理各自 helper 路径和进程生命周期。
- helper 只读取 Main 校验后的会话 WAV 路径，以标准 CLI 进度和临时 SRT 返回结果；最终文档由 Main 校验并原子落盘。
- 预览与导出共用 CaptionBitmapRenderer，字幕层位于视频/运镜/点击效果之上。

## 2. Data Model & Interfaces

```typescript
interface CaptionPosition {
  x: number // 输出画布归一化坐标 0..1
  y: number
}

interface CaptionStyle {
  fontPreset: string
  fontSize: number
  textColor: [number, number, number, number]
  strokeColor: [number, number, number, number]
  strokeWidth: number
  backgroundColor: [number, number, number, number]
  cornerRadius: number
  align: 'left' | 'center' | 'right'
  maxWidthRatio: number
  position: CaptionPosition
  fadeMs: number
}

interface CaptionSegment {
  id: string
  startMs: number
  endMs: number
  text: string
  positionOverride?: CaptionPosition
}

interface CaptionsDocument {
  version: 1
  source: 'mic'
  enabled: boolean
  language: 'auto' | 'zh' | 'en'
  detectedLanguage?: string
  style: CaptionStyle
  segments: CaptionSegment[]
}

type TranscriptionJobState =
  | { state: 'idle' }
  | { state: 'downloading'; progress: number }
  | { state: 'transcribing'; progress: number }
  | { state: 'done'; updatedAt: number }
  | { state: 'cancelled' }
  | { state: 'error'; code: string; message: string }
```

- `captions.json` 与 `events.json` 同处会话目录，所有时间均为源视频时间轴毫秒值。
- `SessionLoadResult` 增加可选字幕 JSON；历史会话无文件时返回 `null`。
- 跨进程契约统一放 `shared/`：模型状态、任务状态、生成/取消/重试、字幕保存和 SRT 保存。
- 字体保存为跨平台 preset ID，映射到 macOS/Windows 的系统中文字体栈；预览与导出在同一机器复用完全相同的映射。
- 模型位于 `userData/models/whisper/`，下载到临时文件并完成摘要校验后原子重命名。

## 3. Data Flow & Interaction

1. 新录像字幕默认关闭；用户开启后，若不存在字幕则按当前语言和模型档位自动开始生成。
2. 模型缺失时 Main 下载并校验 Whisper 与 VAD 模型；关闭开关会通过 AbortSignal 取消整个链路。
3. Main 启动对应平台 helper，以 VAD 限定语音区间并请求词级时间戳；共享纯函数再按停顿、标点、长度和时长重组为句。
4. helper 完成后 Main 校验段落顺序、实际发声区间、时间范围和空文本，原子写入 `captions.json`。
5. 中文默认使用 Small 高精度模型和简体中文 initial prompt；显式中文或自动检测为中文时，通过 OpenCC 在 Main 侧统一转换为简体后再落盘。
5. 编辑器收到完成事件后载入字幕轨；用户可修改文字、时间、分割、合并、删除、样式和位置。
6. 预览按源时间查询活动字幕；视频裁剪只影响播放映射，不修改源字幕文档。
7. MP4 导出使用相同位图渲染；SRT 把字幕投影到裁剪后时间轴，跨裁剪区的字幕按保留段分割。
8. 用户重新生成前须确认覆盖；生成成功才替换旧文件，取消或失败继续保留旧字幕。
9. 任意编辑先进入 pending，400ms 防抖后进入 saving；落盘成功进入 saved，失败进入 error 并可重试。
10. SRT 导入按原始录像时间轴解析，确认后替换；关闭字幕时不暴露导入入口。

## 4. Error Handling

- **无麦克风轨**：禁用生成按钮并说明仅支持麦克风字幕，其他编辑功能保持可用。
- **模型下载失败/校验失败**：删除临时模型，保留可重试状态，不启动损坏模型。
- **helper 崩溃或输出非法**：终止任务并展示用户可读错误；不创建或覆盖 `captions.json`。
- **页面或会话切换**：任务留在 Main；新页面按 `sessionId` 查询当前状态，不出现跨会话结果。
- **取消/删除会话/退出应用**：终止 helper、清理临时结果；已存在的正式字幕文件不受影响。
- **字幕文件损坏**：忽略字幕层并提供重新生成，不阻断视频和编辑文档加载。
- **字体或绘制失败**：回退内置默认中文字体和安全样式，不阻断导出。
