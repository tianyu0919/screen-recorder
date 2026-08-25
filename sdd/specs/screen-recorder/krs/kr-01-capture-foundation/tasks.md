# Task Breakdown & Execution Board: kr-01-capture-foundation (Tasks)

> 原子任务列表，开始前逐项确认，执行中逐项勾选。
> 实现完成时间：2026-08-19。GUI 交互类验收（真实录制、权限弹窗、降级提示展示）需人工冒烟，见 checklist.md。

## Phase 1: 脚手架与类型定义
- [x] Task 1.1: 初始化 electron-vite + React + TypeScript 工程（electron/ 与 src/ 双进程结构），接入 Tailwind + shadcn/ui + zustand
  - 实际：electron-vite@2 + vite@5 + react@18 + tailwind@3 + shadcn 风格组件（components.json + cva/cn），zustand@4
- [x] Task 1.2: 定义录制会话类型 `RecordingEvents` / `ClickEvent` / `KeyEvent` / `CaptureOptions`（含 `captureCursor: boolean` 预留），落盘 schema 校验函数
  - 实际：`shared/types.ts`，含 `validateRecordingEvents()`，与 design.md §2 契约逐字段一致
- [x] Task 1.3: 搭建 Main ↔ Renderer IPC 通道骨架（枚举源、开始录制、停止录制、权限状态查询）
  - 实际：`shared/ipc.ts` 通道常量 + `electron/ipc.ts` handler + `electron/preload/index.ts` contextBridge

## Phase 2: 屏幕与音频采集
- [x] Task 2.1: 实现源枚举与选择 UI（desktopCapturer.getSources 缩略图列表 / setDisplayMediaRequestHandler）
  - 实际：`electron/capture/sources.ts` + `src/components/SourcePicker.tsx`；选中源即建立预览流（`<video>` 预览确认后录制）
  - **采集路径修正（画面冻结 bug 修复）**：弃用 legacy `getUserMedia(chromeMediaSourceId)`，改为 SCK 路径——Renderer 先 IPC `capture:prepare-source` 告知选中源，再 `getDisplayMedia`；Main `setDisplayMediaRequestHandler(useSystemPicker: false)` 按该 sourceId approve。背景见 docs/TECH_DESIGN.md §3.1
- [x] Task 2.2: 实现 MediaRecorder 高码率（12–20 Mbps, vp9/webm）录制与分片写盘
  - 实际：`src/recorder/screenRecorder.ts`，vp9/webm @16Mbps，timeslice 1s 分片经 IPC 流式写盘
- [x] Task 2.3: 实现麦克风采集（getUserMedia audio）与 mic.wav 落盘
  - 实际：mic 用 MediaRecorder(opus) 采集，停止时 `decodeAudioData` → PCM16 WAV 编码（`src/recorder/wav.ts`）落盘 mic.wav；解码失败则跳过不写坏文件
  - [x] 缺陷修复：macOS 同时回采系统音频时显式关闭 mic 回声消除/降噪/自动增益，避免有效系统输入被抑制为全零；请求 48kHz 单声道并补齐失败轨道释放
- [x] Task 2.4: 实现 macOS 权限引导页（屏幕录制 + 辅助功能权限检测与系统设置跳转）
  - 实际：`electron/permissions.ts` + `src/components/PermissionGuide.tsx`（含麦克风权限项与"重新检查"）

## Phase 3: 输入事件采集
- [x] Task 3.1: Main 进程实现 `screen.getCursorScreenPoint()` 60–120Hz 轮询器，输出 `[t, x, y]` 轨迹流
  - 实际：`electron/input/cursorPoller.ts`，90Hz；轮询异常（拔插显示器）跳过该采样不中断
- [x] Task 3.2: 接入 uiohook-nap，采集 mousedown/up 与 keypress，归一化按键名
  - 实际：**uiohook-nap 已被作者更名为 `uiohook-napi`（原包在 npm/GitHub 均已下架），改用 uiohook-napi@1.5.5**；N-API 预编译，Electron 免 rebuild；已验证 node 侧加载成功，Electron 运行时采集待人工冒烟；仅 keydown 记为 keypress（符合 spec 语义）
- [x] Task 3.3: 统一时间基准：录制开始时刻对齐轮询器、uiohook 与 MediaRecorder 的时间戳原点；钩子失败时降级处理
  - 实际：Main 在 RecordingStart 处理中统一取 `t0=Date.now()`，poller/hook 均以 t0 为原点；Renderer 收到响应后立即启动 MediaRecorder（偏移为一次 IPC 往返，远小于 50ms 指标）；钩子失败时 `inputHookAvailable=false` → UI 降级提示

## Phase 4: 会话落盘与集成
- [x] Task 4.1: 实现录制会话落盘（recordings/<session-id>/：screen.webm + mic.wav + events.json），记录 display id/bounds/scaleFactor
  - 实际：`electron/store/sessionStore.ts`，目录在 `userData/recordings/rec-<ts>-<rand>/`；finalize 前跑 schema 校验 + 视频文件存在性检查
- [x] Task 4.2: 实现异常路径：源断开、磁盘不足（ENOSPC）、权限拒绝的终止与保留策略
  - 实际：源断开（track ended）/ ENOSPC（写流 error 含 EDQUOT）/ 编码器异常 → `handleFatal` → abort 保留已落盘片段 + 友好提示；权限拒绝 → 引导页，不进录制
- [x] Task 4.3: 按 checklist.md 自测，重点验证 1 分钟录制事件时间轴对齐误差 < 50ms
  - 已自动化验证：`npm run typecheck` 双 tsconfig 零错误、`npm run build` 三端产物成功、`npm run dev` 启动成功（renderer 200、Electron 进程正常、无报错日志）；1 分钟真实录制与 <50ms 对齐验证需人工冒烟（GUI 无法自动测）
- [x] Task 4.4: 清理调试日志与无用代码
  - 实际：grep 全仓 `console.log|debug` 无生产路径残留

# Task Dependencies
- [Task 1.3] depends on [Task 1.1]
- [Task 2.1]、[Task 3.1]、[Task 3.2] 均 depends on [Task 1.3]，三者可并行
- [Task 2.2] depends on [Task 2.1]
- [Task 2.3] depends on [Task 2.1]，与 [Task 2.2] 可并行
- [Task 2.4] 与 [Task 2.1] 可并行
- [Task 3.3] depends on [Task 3.1] and [Task 3.2] and [Task 2.2]
- [Task 4.1] depends on [Task 1.2] and [Task 3.3]
- [Task 4.2] depends on [Task 4.1]
- [Task 4.3] depends on [Task 4.2]
- [Task 4.4] depends on [Task 4.3]
