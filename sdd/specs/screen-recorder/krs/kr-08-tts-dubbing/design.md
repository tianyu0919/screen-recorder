# Design: 本地 TTS 配音（按字幕重读与无录音配音） (Design)

## 1. Architecture

整体复用 whisper-caption 的"原生 helper + Main 服务 + Renderer 管线"三层模式：

```
┌─ Renderer (React)
│   ├─ src/tts/                     平台无关合成准备（纯函数为主）
│   │   └─ segments.ts              字幕段 → 合成任务、分段缓存键、derivedKey
│   ├─ src/store/previewTtsActions.ts  启用/切音色/A-B 切换/重生成动作
│   └─ src/components/preview/      检查器「配音」区（音色列表、进度、溢出标记）
├─ shared/
│   ├─ tts.ts                       TtsVoiceInfo / TtsJobRequest / 引擎抽象接口
│   ├─ ttsModels.json               内置音色清单 + 大小 + SHA-1（仿 captionModels.json）
│   ├─ ttsPcm.ts                    WAV、带限重采样、WSOLA、边界淡化与等长拼接（纯函数）
│   └─ ipc.ts                       新增 tts 通道（白名单）
├─ electron/tts/                    Main 进程（仿 electron/transcription/）
│   ├─ index.ts                     平台分发（只分发，不写实现）
│   ├─ darwin.ts / win32.ts         helper 路径与启动（resourcesPath/tts-helper/…）
│   ├─ helper.ts                    子进程协议（stdin JSON 任务 / 逐段 WAV 文件 / stdout 结果）
│   ├─ modelManager.ts              内置模型解析 + 自定义模型导入登记 registry.json
│   ├─ assemble.ts                  段缓存读取 + 变速贴合 + 等长拼接 + 原子写派生 WAV
│   └─ service.ts                   按 sessionId 的任务去重/持有/取消
└─ native/tts-helper/               C++ (sherpa-onnx, Kokoro/Matcha/VITS)
    ├─ build.mjs                    按平台编译（挂 npm run build:native）
    └─ models/                      中英双语、中文专用、英文专用三套内置模型（开发模式）
```

关键约束（来自 AGENTS.md）：
- 平台差异只出现在 `electron/tts/{darwin,win32}.ts`（helper 路径、启动参数、进程管理）；协议与调度全部平台无关。
- helper 经 electron-builder `extraResources` 放到 `resourcesPath/tts-helper/`，与 `electron/tts/{darwin,win32}.ts` 查找路径一一对应（改路径三处同步：native 构建产物、electron-builder.yml、electron 查找）。
- Renderer 平台判断走 `window.api.platform`；引擎抽象在 `shared/tts.ts`，云端 TTS 一期仅占位（`engine: 'local'`，类型上预留 `'cloud'`）。

## 2. Data Model & Interfaces

### shared/tts.ts（新增）

```typescript
export type TtsEngineKind = 'local' | 'cloud' // cloud 一期仅占位，不实现

export interface TtsVoiceInfo {
  id: string            // 内置为 ttsModels.json 的 id；自定义为 custom-<sha1 前 12 位>
  name: string
  languages: Array<'zh' | 'en'>
  bundled: boolean      // 官方随包内置；false 仅用于自定义导入
  size: number
}

export interface TtsSegmentRequest {
  segmentId: string     // 字幕段 id
  text: string
  startMs: number       // 字幕时间窗（源时间轴）
  endMs: number
  cacheKey: string      // sha1(text + voiceId + engineVersion + modelId)
}

export interface TtsJobProgress {
  sessionId: string
  total: number
  done: number
  currentSegmentId?: string
}
```

### 分段缓存键

`cacheKey = sha1(normalize(text) + voiceId + engineVersion + modelId)`。
时间区间不参与缓存键：仅拖动字幕起止时复用原始合成音频，只重跑 `rateFit` + 拼接（spec「改字幕时间区间」场景）。

### edit.json → V3（`shared/edit.ts`）

```typescript
export interface TtsSettings {
  enabled: boolean
  voiceId: string
  engineVersion: string
  /** 当前生效派生轨；会话目录内文件名，如 tts-a1b2c3.wav */
  derivedFile?: string
  /** 派生轨的整轨指纹：sha1(各段 cacheKey + 变速参数 + 字幕时间窗序列) */
  derivedKey?: string
}
// EditDocumentV3 = V2 + tts?: TtsSettings
```

V1/V2 读取时迁移为 `tts` 缺省（视为关闭）；V3 保存沿用 revision 守卫 + 临时文件 `fsync + rename` 原子替换。派生 WAV 写入会话目录（与 `mic.wav` 同级），`mic.wav` 永不修改。

### mic 轨位切换

派生轨不是新轨种：预览（`useSyncedAudio` / `useClipsAudio` 的 mic 源）与导出（`src/export/audio.ts` 混音入口）统一经一个"mic 位音频源解析"函数取当前生效源（原声 or 派生轨）。增益/静音/裁剪逻辑零改动。无录音会话：派生轨以视频时长为等长基准，mic 位原本为空，解析函数直接返回派生轨。

## 3. Data Flow & Interaction

生成流程（有录音重读与无录音配音共用）：

1. 用户在检查器「配音」区选音色并确认 → `previewTtsActions.startTtsJob()`
2. Renderer 读取当前 `captions.json` 字幕段（空 → 提示先加字幕，中止），逐段计算 `cacheKey`，查会话级缓存索引（`derivedKey` + 会话目录 `tts-*.wav` 清单）：
   - 命中 → 复用该段已合成 PCM/WAV；
   - 未命中 → 收集为待合成任务。
3. Renderer 经白名单 IPC 把待合成段交给 Main；`electron/tts/service.ts` 按 `sessionId` 去重持有任务，页面切换不终止；`darwin.ts`/`win32.ts` spawn helper，逐段下发（stdin JSON），从 stdout 收段 WAV，stderr 解析进度回报 Renderer；取消 = 终止 helper（无半成品写入会话目录，临时文件先落 `userData/tmp`）。
4. 全部段就绪后由 Main 直接组装（**修正：不在 Renderer Worker**——段 PCM 已落盘在会话目录 `tts-segments/`，Main 本地读文件零 IPC 传输；重负载在 Node 进程而非 Renderer 主线程）：每段经 `shared/ttsPcm.ts` 的 `planRateFit`（不对称：音频超长时 +20% 内 WSOLA 保调加速贴合、超阈值取端点速率并标记溢出段；音频偏短保持自然语速留静——实测 -20% 减速全线可闻机械感，验收后修正）→ Blackman-windowed sinc 带限重采样到 48k → 实际写入边界施加 8ms 淡入淡出 → 按段起点写入等长静音底（mic.wav 长度或视频时长）→ 溢出部分被下一段起点截断；输出 48kHz/2ch/int16（与 mic.wav 同规格），原子写入会话目录 `tts-<derivedKey 前 8 位>.wav`。
5. `edit.json` 更新 `tts` 字段（enabled、voiceId、derivedFile、derivedKey）→ mic 位源解析切换 → 预览立即生效，导出走同一混音入口。

试听流程：音色列表点击试听 → 对固定示例句走同一 helper 单次合成 → 内存播放，不写会话目录、不进缓存。

## 4. Error Handling

- **helper 缺失/启动失败**：TTS 入口降级禁用 + 原因提示；原声 mic 轨与其他编辑功能不受影响（平台分发返回 null 的静默降级约定同样适用于未来其他平台）。
- **某段合成失败**：该段按静音处理并在字幕轨标记失败，允许整轨完成；用户可点"重试失败段"只重跑失败段（缓存键不变）。
- **模型文件丢失/校验失败**：音色列表保留回显但禁止生成（同 caption 模型缺失语义）；已有派生轨继续可用（文件已存在，不依赖模型）。
- **派生 WAV 丢失或 `derivedKey` 校验失败**：回退原声/静音 + 提示重新生成；导出前同样校验，禁止静默导出与预览不一致的结果。
- **溢出段**：不视为错误；UI 标记 + 一键定位，用户改文字或拉长时间窗后重生成消除。
- **生成中切换会话/退出**：任务按 `sessionId` 隔离；应用退出时若有进行中任务，复用导出队列的退出保护语义确认取消；临时文件不进入会话目录，无半成品污染。
- **字幕为空或全在裁剪区外**：不允许生成（提示先添加字幕）；注意派生轨按源时间轴等长生成，裁剪只在预览/导出映射期生效，不把裁剪烘焙进派生文件。
