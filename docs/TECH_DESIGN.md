# Screen Studio 类录屏软件 — 技术方案（Electron 跨平台版）

> 目标：一款"录制时记录数据，导出时自动运镜"的演示视频工具。
> 核心差异点：缩放运镜、鼠标美化不在录制时做，而是在导出/预览阶段基于录制期采集的鼠标事件重新合成。

---

## 1. 产品核心能力拆解

| 能力 | 本质 | 依赖数据 |
|---|---|---|
| 自动缩放运镜 | 虚拟相机在画布上做 spring/easing 动画 | 鼠标点击事件（时间戳 + 坐标） |
| 鼠标平滑/放大 | 光标不录进画面，导出时用矢量光标重绘 | 鼠标轨迹（高频坐标序列） |
| 点击高亮 | 在点击时刻叠加波纹动画 | 点击事件 |
| 背景构图 | 默认按源尺寸输出；可选 1920×1080 纯色背景画布 | 录制分辨率 + edit.json V2 背景设置 |
| 按键回显 | 键盘事件叠加层 | 键盘事件 |
| 画中画摄像头 | 第二路采集，合成时叠加 | webcam 视频流 |

**结论：所有效果都是"数据驱动的时间线渲染"。录屏只是素材采集。**

---

## 2. 总体架构

```
┌─────────────────────────────────────────────────────┐
│ Renderer 进程 (React)                                │
│  ├─ 录制控制 UI / 预览播放器 / 简单时间线编辑器        │
│  └─ 运镜渲染器（WebGL，预览 & 导出共用同一套管线）      │
├─────────────────────────────────────────────────────┤
│ Main 进程 (Node)                                     │
│  ├─ 屏幕采集控制（desktopCapturer 源选择）             │
│  ├─ 全局输入监听（鼠标轨迹 / 点击 / 键盘）             │
│  ├─ 文件管理（录制会话落盘）                           │
│  └─ 原生能力桥接（可选 native helper）                │
├─────────────────────────────────────────────────────┤
│ Worker 线程                                          │
│  └─ 离线导出：逐帧渲染 → WebCodecs 编码 → mux mp4     │
└─────────────────────────────────────────────────────┘
```

### 关键设计原则：录制与渲染分离

- **录制期**：只做两件事 —— 编码原始画面、高频记录鼠标/键盘事件。CPU 占用尽量低。
- **渲染期**：预览和导出共用同一个"虚拟相机 + WebGL 合成器"，预览是实时模式，导出是确定性逐帧模式（不受机器性能影响，保证 60fps 输出）。

---

## 3. 录制模块

### 3.1 屏幕画面采集

- 源枚举：`desktopCapturer.getSources({ types: ['screen', 'window'] })`。若系统合成器返回个别空缩略图，Main 等待 250ms 后自动补取一次，只替换失败项并保留首次成功结果。
- **整屏选中反馈**：Renderer 选择 `screen` 来源后通过 preload 白名单通知 Main；`electron/displaySelectionOutline/` 以 source 的 `display_id` 精确匹配 `screen.Display`，并由 `darwin.ts` / `win32.ts` 创建覆盖目标 bounds 的透明、不可聚焦、鼠标穿透置顶窗口。Windows 辅助窗口显式使用 `skipTaskbar` 隐藏任务栏/Alt+Tab 项；macOS 不调用 `skipTaskbar` 或 `setVisibleOnAllWorkspaces`，只用 `setHiddenInMissionControl` 与窗口菜单排除隐藏辅助层，避免 Electron 为跨 Space 窗口转换整个进程类型而导致 Lenza 从 Dock/Command+Tab 消失。覆盖层只绘制稳定的 Lenza 橙色内边框，窗口来源不显示系统级边框；显示器拔插/缩放、主窗口隐藏、视图切换和来源失败均会清理或更新覆盖层。
- **录制前清理顺序**：点击开始录制时必须先 `await hideDisplaySelectionOutline()`，等待覆盖窗口销毁及桌面合成器刷新，再启动 Main 录制会话与 Renderer `MediaRecorder`，避免边框进入视频首帧。该提示不写入 `events.json` 或设置数据。

> **窗口源的固有语义（产品决策，2026-08-19 冒烟确认）**：窗口采集锁定的是"选定那一刻的窗口"，目标 App 在录制期间新弹出的窗口录不上。因此产品定为**整屏主模式**，窗口模式仅限单窗口演示场景；App 级采集（SCApplication 粒度，跟随整个 App 的全部窗口）留给原生 helper（kr-04），记 backlog。
- **窗口录制固定画布与动态几何（kr-01 window-capture-fixed-canvas）**：窗口来源开始录制时，Main 以窗口所在显示器（由几何 helper 探测首样本定位，回退光标显示器）的物理分辨率偶数化后冻结为恒定视频画布；Renderer 把克隆视频轨移交归一化 Worker（`MediaStreamTrackProcessor` → OffscreenCanvas 等比居中 → `VideoTrackGenerator`），MediaRecorder 只录恒定尺寸生成轨，窗口移动/缩放/最大化不再改变录制分辨率。准备阶段只探测画布并创建各 MediaRecorder；编码器启动后通过独立 activate IPC 同时建立正式 `t0`、窗口几何、输入与系统音频时间轴，避免 Worker/麦克风准备耗时造成事件偏移。窗口 bounds 由原生 helper 以 ~60Hz 采样并随 events.json V2 落盘：macOS 为 `native/window-geometry/darwin`（Swift + CGWindowList，按 CGWindowID 查询）；Windows 为 `native/window-geometry/win32`（Rust + DWM 输出物理 bounds，Main 用 Electron `screenToDipRect` 转换为与 uiohook 一致的全局 DIP，正确处理混合 DPI 多屏原点）；helper 经 `electron/capture/windowGeometry/{darwin,win32}.ts` 平台分发，打包后放入 `resourcesPath` 根（`window-geometry` / `window-geometry.exe`，构建见 `native/build.mjs`）。波纹、自动运镜与鼠标跟随统一走 `src/timeline/windowGeometry.ts` 的 `screenPointToCanvas`（按时间插值几何 + 等比 placement），当时刻窗口外的点击不产生波纹/运镜目标。helper 缺失或短时无 bounds 时沿用最近有效样本并退回 V1 显示器换算，不阻断录制；最小化/零尺寸帧时 Worker 重复最后画面保持时间轴连续。归一化管线降级：Chromium 的 `MediaStreamTrackProcessor`/`VideoTrackGenerator` 仅暴露于 DedicatedWorker，且采集轨可能不允许 transfer/clone 进 Worker（Windows 实机已遇到）；此时自动降级为主线程隐藏 `<video>` + 固定 `<canvas>` + `captureStream(0)` 手动帧归一化（`src/recorder/fixedCanvasMainThread.ts`），功能等价。
- 采集：**ScreenCaptureKit 路径（已定）** —— Main 进程 `session.setDisplayMediaRequestHandler`（`useSystemPicker: false`，handler 按 Renderer 选好的 sourceId 直接 approve）+ Renderer `navigator.mediaDevices.getDisplayMedia()`。**不再使用 legacy `getUserMedia(chromeMediaSourceId)`**：实测 macOS 15 上 legacy 窗口采集在窗口缩放/移动时帧更新不可靠（画面停滞、黑边错位）；SCK 路径整屏/窗口/遮挡/多屏场景均已实测帧持续更新。
- 编码：录制期直接用 `MediaRecorder`（vp9/webm 或 h264/mp4，高码率，如 12–20 Mbps）—— 先把画面存下来，质量损失对演示视频够用
- 进阶（v2）：用 `MediaStreamTrackProcessor` + `VideoFrame` 拿原始帧，WebCodecs 编码，可控关键帧和码率

### 3.2 光标问题（Electron 路线最大的坑，必须早决策）

Screen Studio 能"放大/替换/平滑光标"的前提是：**光标没有被烧录进原始画面**。
而 Electron 的屏幕采集在所有平台上**默认把系统光标画进流里**，且没有官方开关。

三个方案：

| 方案 | 做法 | 代价 |
|---|---|---|
| A. 接受光标烧录（MVP） | 不做光标替换，只做点击高亮和缩放运镜 | 零成本，但做不了光标放大/平滑 |
| B. 原生采集 helper（推荐 v2） | macOS 写一个 Swift 小工具用 ScreenCaptureKit（`showsCursor = false`），Windows 用 `Windows.Graphics.Capture`（`IsCursorCaptureEnabled = false`），通过子进程或 N-API 把帧/流喂给 Electron | 每个平台一段原生代码，但是唯一彻底解 |
| C. 取巧 | 录制时把系统光标设为透明（macOS 可用 `NSCursor.hide` 类 hack，不稳） | 不推荐 |

**建议：MVP 走 A，架构上预留 B 的接口（录制器抽象出 `captureCursor: boolean`）。**

### 3.3 鼠标与键盘事件采集（运镜的数据基础）

- **鼠标轨迹**：Main 进程里用 `screen.getCursorScreenPoint()` 以 60–120Hz 轮询，记录 `{ t, x, y }`。够用且零依赖。
- **点击/键盘事件**：需要全局钩子，用 [`uiohook-napi`](https://www.npmjs.com/package/uiohook-napi)（原 uiohook-nap 已被作者更名为此包；维护中的 iohook 替代品，N-API 预编译免 rebuild，支持 macOS/Win/Linux）。点击记录 mousedown；键盘在采集层维护 modifier keydown/up，只落盘快捷键、功能键和单独修饰键，无修饰普通字符不进入新会话，重复按键以 250ms 限流。
- 多屏/缩放：记录事件时同时记录 `display.id`、`scaleFactor` 和屏幕 bounds，渲染期做坐标换算。

### 3.4 音频

- 麦克风：`getUserMedia({ audio: true })`，单独一条轨
  - macOS 权限由首页麦克风开关主动申请：`unknown` 调用 Main 的 `systemPreferences.askForMediaAccess('microphone')`，`denied` 跳转“隐私与安全性 → 麦克风”；权限非 `granted` 时开关保持关闭。
  - 麦克风是可选轨。关闭或未授权时允许正常录制且不创建 `mic.wav`；开始录制和 WAV 写入阶段不再触发延迟授权。开始前权限被撤销或 `getUserMedia` 失败时，Renderer 明确提示并降级为无麦克风录制。
- 编辑器自定义音轨：导入时只执行一次 `decodeAudioData`，缓存 PCM（导出混音）与同一次解码得到的 `AudioBuffer`（预览）；所有自定义 clip 共用一个 `AudioContext`，在播放、seek、速率变化和缓冲恢复边界用 `AudioBufferSourceNode.start(when, offset, duration)` 重建调度，逐帧路径不 seek、不再为 FLAC/MP3 创建额外媒体解码器。波形横向滚动同步平移 `trimStartMs / trimEndMs` 做素材滑移，保持 `offsetMs` 与片段长度；纵向滚动继续沿用时间轴缩放，方向判断兼容鼠标与 macOS 触控板。
- 录制后字幕（kr-06 第一阶段）只读取已经完整落盘的 `mic.wav`，不进入录制热路径。Renderer 通过白名单 IPC 发起任务，Main 在 `electron/transcription/` 按 `sessionId` 去重并持有后台任务，页面切换不终止；显式取消、删除会话或退出应用会终止 helper。模型不走网络下载：Whisper Small 多语言模型与 Silero VAD 随安装包内置（`resourcesPath/whisper-models/`，开发模式为 `native/whisper-caption/models/`，清单与校验值见 `shared/captionModels.json`）；用户可导入其他 whisper.cpp ggml 模型，经格式/摘要/helper 探测后原子复制到 `userData/models/whisper/` 并登记 `registry.json`（仅存 Main 生成的稳定 ID，Renderer 不传文件路径），录音不上传。macOS 与 Windows 分别由 `darwin.ts` / `win32.ts` 启动对应 `whisper-caption` CLI；macOS 固定禁用 Metal 走 CPU，避免部分设备分配 Metal buffer 失败。helper 通过 stderr 上报进度并生成临时 SRT，Main 校验、归一化后才原子替换 `captions.json`（记录生成模型的 ID/名称，模型缺失时保留回显并阻止重新生成）。
- 本地 TTS 配音（kr-08）：以会话字幕为输入做"按字幕重读"（有录音替换 mic 轨位）与"字幕配音"（无录音生成虚拟 mic 轨），全程本机。引擎为 sherpa-onnx 预编译包（v1.12.20）+ 跨模型族 C++ CLI（`native/tts-helper/src/main.cpp` + `json_protocol.cpp`）：启动参数按 `kokoro` / `matcha` / 自定义 `vits` 填充模型配置，stdin 逐行 JSON 任务（text/sid/speed/out），stdout 回 ready 与逐段结果。段 WAV 落会话目录 `tts-segments/<cacheKey>.wav`（cacheKey = sha1 规范化文本+音色+引擎/模型版本，时间窗不入键）；`electron/tts/` 按 darwin/win32 分发（darwin 用 clang++ 直编、win32 用 cmake，均挂 `npm run build:native`）。Main 在 `shared/ttsPcm.ts` 以带限 Blackman-windowed sinc 统一重采样到 48kHz，超长段用有效输入范围内的归一化相关 WSOLA 加速贴合（+20% 内，超阈值端点速率+溢出标记），偏短段保持自然语速留静；每个实际写入边界（含被下一段截断处）施加 8ms 淡入淡出，最终原子写为等长 48kHz/2ch/int16 派生轨 `tts-<derivedKey 前8位>.wav`。派生轨占用 mic 轨位：预览经 `media://rec/<sid>/<file>`、导出经 `resolveMicSlotFile(edit.json)` 统一取当前生效源，增益/静音/裁剪/混音零改动复用；派生丢失回退原声并禁止静默导出不一致结果。官方音色全部随包内置到 `resourcesPath/tts-models/`：Kokoro v1.1 int8 中英、Matcha Icefall Baker 中文 + Vocos、Kokoro English v0.19；不保留官方下载/按需下载入口，用户仍可导入 sherpa-onnx VITS 兼容模型目录（探测 numSpeakers 后登记 `userData/models/tts/registry.json`）。Matcha Baker 随附说明标注其训练数据仅限非商业使用，因此正式商业发行前必须替换或取得授权。
- 系统声音（kr-01 system-audio 已落地）按平台分路径，产物都是 `system.wav`（48kHz/2ch/int16，与 mic.wav 同规格），预览/导出期与 mic.wav 混合：
  - **双轨回声对齐**：音箱外放时 mic 轨会 acoustically 录入系统音，与 system.wav 混合形成回声；两条采集链有固定延迟差（声卡/Voicemeeter 引擎缓冲，逐机不同，实测 ~183ms）。预览（useSyncedAudio 偏移播放）与导出（mixPcm 偏移混合）统一用 `src/lib/audioAlign.ts` 的降采样互相关估计 system 相对 mic 的恒定偏移并对齐；归一化相关度不足（耳机用户 mic 无系统音）→ 偏移 0 不对齐。
  - **macOS**：loopback 轨在 macOS 上出生即 ended、电平恒 0（electron#52738），不可用。走原生 helper：Main 在录制开始时 spawn `native/sck-audio`（Swift + ScreenCaptureKit，`capturesAudio` + `excludesCurrentProcessAudio`，全系统音频回采），流式写 `system.wav`。首次运行会触发 macOS「屏幕与系统音频录制」TCC 授权。
  - **Windows**：Renderer loopback + MediaRecorder 路径有杂音（Chromium 回环采样率不匹配爆音 + 默认低码率 Opus 失真），已弃用。走原生 helper：Main spawn `native/wasapi-audio`（Rust + WASAPI shared-mode loopback，采默认渲染设备混音，float32 → int16，非 48k 设备用 rubato sinc 重采样；>2ch 设备取 ch0/ch1 主立体声），流式写 `system.wav`。
    - **VB-Audio 虚拟设备绕行（Voicemeeter/VB-Cable 用户）**：VB 虚拟渲染设备（"Voicemeeter Input" 等）的 loopback tap 返回全零（驱动怪异行为，Chromium 同样中招）。helper 检测到默认渲染设备是 VB 虚拟设备时，自动改采对应的总线镜像采集端点（"Voicemeeter Input" → "Voicemeeter Out B1"、AUX → B2、VAIO3 → B3、"CABLE Input" → "CABLE Output"），并通过 Voicemeeter Remote API 临时打开虚拟输入条带的 Bx 路由（仅作用于引擎运行时不写用户配置，录制结束恢复原值；Remote 指令需保持登录 ~800ms 才下发）。绕行产生的启动延迟会补等长静音，保持 system.wav 与画面 t=0 对齐。
  - **其他平台**：Main 分发返回 null，由 Renderer 侧 loopback 兜底——`setDisplayMediaRequestHandler` 回调带 `audio: 'loopback'` + `getDisplayMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })` 拿回采轨，**必须关闭语音处理**；画面 MediaRecorder 只用 video track 建新流，系统音频不混入 screen.webm；单独 MediaRecorder 落盘 system.wav。不支持的平台静默无音轨。
  - helper 统一协议：录制停止时 Main 关闭 helper stdin（EOF）通知其 patch WAV header 后退出，2s 超时强杀兜底（macOS 实测 DispatchSourceSignal 在挂了 SCStream 的进程里不触发，SIGTERM 仅作兜底）。helper 缺失/启动失败静默降级为无系统音轨；helper 提前非零退出会清掉 header-only 残留，避免被当成有效音轨。helper 构建：`npm run build:native`（按平台分发：darwin 跑 swiftc，win32 跑 cargo）。

### 3.5 录制会话数据格式（落盘）

新录制默认根目录为 `app.getPath('videos')/Lenza`（Windows「视频/Lenza」、macOS `Movies/Lenza`），用户可在设置中切换；切换仅影响新录制。`electron/store/sessionCatalog.ts` 在 `userData/session-index.json` 维护跨根目录索引，旧 `userData/recordings` 自动登记但不搬迁。Main 负责解析 sessionId 到受信绝对路径，Renderer 不接触任意文件路径。

应用偏好由 `electron/store/appSettings.ts` 写入版本化 `userData/settings.json`，包含主题、当前/历史录制根、回收站周期、关闭策略与本机预览清晰度；新字段通过默认值合并迁移。删除先将完整会话移入 `userData/trash` 并记录原位置和清理时间，到期或二次确认后才永久删除。根目录离线与根可访问但会话缺失必须区分，后者只允许移除失效索引。用户可编辑的录像 `displayName` 存在 `session-index.json`，`sessionId` 与磁盘目录保持不可变；详情页和会话卡片显示 `displayName ?? sessionId`，MP4/WebM/SRT 默认文件名复用显示名称并继续执行无覆盖 `(n)` 命名。名称校验由 `shared/sessionName.ts` 跨进程共用，保证双平台文件名安全。

“全部录制”首次进入只读取一次会话索引，手动刷新时才重新扫描录制根目录；Renderer 每批挂载 20 个卡片，并由滚动容器内的 `IntersectionObserver` 提前加载下一批。卡片进入可视区域附近后才读取源视频元数据并截取 320×180 WebP 缩略图，派生文件按 `<session-id>.webp/.json` 写入 `userData/cache/session-thumbnails/`，不进入录制目录。缓存元数据记录源视频大小和修改时间，失配或损坏时自动重建；会话永久删除、失效索引移除和过期清理会同步清理缓存，移入/恢复回收站则保留。缩略图通过受限的 `media://thumb/` 协议读取；悬停动态预览只临时挂载原视频，离开后立即卸载，因此滚动离屏再返回复用本地缩略图，不重新解码原视频。

关闭后台运行按平台拆分在 `electron/windowLifecycle/`：Windows 从 `resourcesPath/tray-icon.ico` 创建系统托盘，且仅在托盘创建成功后隐藏主窗口，并保留“后台运行 / 直接退出”设置与首次确认；macOS 遵循原生生命周期，红色关闭按钮固定隐藏窗口并通过 Dock `activate` 恢复，只有 `⌘Q` / 菜单栏退出结束进程，Renderer 不展示关闭策略设置。macOS 原生应用菜单在 ready 后一次性构建且不创建 Reload/Force Reload 项，禁止运行时修改默认 AppKit 菜单对象；Main 的 `before-input-event` 同时拦截 `⌘R`/`Ctrl+R`/F5。Windows 不创建应用菜单。共享分发层只选择 `win32.ts` / `darwin.ts`，不混合平台实现。

macOS 窗口使用 `hiddenInset`：Renderer 仅在红绿灯同行保留左侧安全区与中间拖拽区，右侧集中放置软件更新、主题切换和应用设置；下方品牌/图标行及交互浮层统一为 `app-nodrag`，避免 Electron 拖动区域吞掉 hover/click。Windows 继续使用 Renderer 自绘标题栏与最小化/最大化/关闭按钮，标题栏空白区域保持可拖动，平台布局集中在 `src/components/AppHeader.tsx` 分发。

Main 进程启动时通过 Electron 单实例锁阻止重复实例。再次从快捷方式或应用目录启动时，`second-instance` 事件统一调用平台窗口恢复逻辑：最小化窗口先还原，后台隐藏窗口重新显示并聚焦；macOS 同时激活应用。

```
<recordings-root>/<session-id>/
├── screen.webm          # 原始屏幕画面（纯视频轨）
├── mic.wav              # 麦克风（可选）
├── system.wav           # 系统音频（可选，kr-01 system-audio）
├── webcam.webm          # 摄像头（可选）
├── events.json          # 不可变的录制元数据 + 原始事件流
├── edit.json            # 版本化非破坏编辑覆盖（可选）
├── captions.json        # 字幕文本、源时间轴区间、样式与位置覆盖（可选）
├── custom-audio/        # 导入到该会话的音频资产（可选）
├── tts-segments/        # TTS 分段合成缓存 <cacheKey>.wav（可选，kr-08）
└── tts-<key>.wav        # TTS 派生轨（等长 mic 位替换，可选，kr-08）
```

`events.json`：

```json
{
  "version": 1,
  "startTime": 1723987200000,
  "display": { "id": 1, "bounds": [0, 0, 2560, 1440], "scaleFactor": 2 },
  "video": { "width": 2560, "height": 1440, "fps": 60, "file": "screen.webm" },
  "mouseTrack": [[0, 320, 240], [8, 325, 243], ...],
  "clicks": [{ "t": 1200, "x": 512, "y": 300, "button": 1 }],
  "keys": [{ "t": 3400, "key": "Enter" }]
}
```

> 时间戳全部相对录制开始（ms），与视频帧对齐。鼠标轨迹用数组压缩存储（量大，可上万条/分钟）。

窗口录制会话升级为 V2（整屏录制仍为 V1；读取端经 `normalizeRecordingEvents` 归一化为内存 V2 模型，V1 原文件不被修改）：

```json
{
  "version": 2,
  "startTime": 1723987200000,
  "display": { "id": 1, "bounds": [0, 0, 2560, 1440], "scaleFactor": 2 },
  "source": {
    "type": "window",
    "id": "window:12345:0",
    "fixedCanvas": { "width": 2560, "height": 1440 },
    "windowGeometry": [[0, 100, 80, 1280, 720], [1520, 240, 120, 1600, 900]]
  },
  "video": { "width": 2560, "height": 1440, "fps": 60, "file": "screen.webm" },
  "mouseTrack": [[0, 320, 240], ...],
  "clicks": [{ "t": 1200, "x": 512, "y": 300, "button": 1 }],
  "keys": [{ "t": 3400, "key": "Enter" }]
}
```

> `fixedCanvas` 为录制期冻结的恒定画布（窗口所在显示器物理分辨率，偶数化），`video` 尺寸与之相等；窗口原始帧等比居中写入该画布，macOS 路径会先按系统窗口圆角裁出 alpha，避免 ScreenCaptureKit 的透明角被 WebM 编成黑边。`windowGeometry` 样本为 `[t, x, y, w, h]`，屏幕 DIP 坐标（与 mouseTrack/clicks 同坐标系）。几何变化时会在新样本前补旧 bounds 保持点，静止窗口不产生逐帧重复数组；渲染期仅在真实变化的短区间内线性插值，窗口外的点击不生成波纹/运镜。开发模式由 `predev` 先构建当前平台 geometry helper，避免缺失时间线后误用显示器坐标定位窗口点击。

`events.json` 和原始音视频只读；运镜片段与总开关、隐藏的关联波纹、手动按键提示、裁剪、分轨 gain/mute、自定义音频 clip、背景图层设置及按键提示全局位置统一写入 `edit.json`。当前文档为 V2；读取 V1 时补齐 `motionEnabled=true`、各轨 `muted=false`、`backgroundEnabled=false`、`backgroundColor=#16181D` 与 `backgroundPaddingPercent=6`，读取缺少边距字段的旧 V2 文档时同样补齐 `backgroundPaddingPercent=6`。Renderer 以 revision 守卫协调手势结束即时保存和 500ms 离散操作防抖，Main 采用同目录临时文件 `fsync + rename` 原子替换；失败保留内存脏数据并提供重试。成功保存返回 `updatedAt`，会话列表按最近编辑时间优先排序。

`captions.json` 为独立 V1 文档，保存 `mic` 来源、语言、MP4 烧录开关、全局样式/位置和源时间轴字幕段；单段只允许覆盖位置。Main 读取时按视频时长校验和钳制，损坏或缺失时按无字幕降级；编辑保存同样使用临时文件 `fsync + rename`，不会修改 `events.json`、`edit.json` 或原始音视频。会话列表的最近编辑时间同时考虑该文件。

---

## 4. 运镜渲染引擎（核心模块）

这是产品灵魂，预览和导出共用。

### 4.1 虚拟相机模型

- 把录制画面视为一张 `(W, H)` 的大画布；背景关闭时输出视口为源尺寸，背景开启时为 `1920×1080`
- 相机状态：`{ x, y, zoom }`（视口中心点 + 缩放倍率）
- **可编辑运镜效果**：首次打开旧会话时把点击派生结果物化为稳定 `MotionEffect`。片段支持新增、删除、主体移动和双端拉伸，最短 300ms、100ms 网格及播放头/事件/相邻边界磁吸，且禁止重叠。自动运镜与点击波纹以源点击索引和相对偏移关联；主体移动或左端调整同步移动波纹，右端只改结束，删除仅写覆盖而不改原事件。编辑后焦点与波纹坐标按新的源时间重新采样 `mouseTrack`，手动运镜不生成波纹。
- **放大鼠标跟随**：仅在 `zoom > 1.05` 的运镜区间消费 `mouseTrack`；不设置视口百分比安全区，任意超过 2px 去抖阈值的有效移动都会按 32ms 有界采样更新相机目标，并经过快速轻量 spring 与画布边缘钳制。回到全景或进入下一运镜焦点时停止当前跟随；预览与导出复用同一组派生关键帧。
- **相机动画**：关键帧之间用 spring 阻尼曲线插值（react-spring 的 spring 物理或手写 RK4），保证运动有"肉感"不生硬

### 4.2 渲染器

- **WebGL**（自研 shader 或用 PixiJS）：每帧根据相机状态对视频纹理做仿射变换 + 叠加层（光标、点击波纹、按键徽章、字幕）
- 视频解码：导出用 WebCodecs `VideoDecoder` 精确逐帧取帧；预览用 `<video>` 提供媒体时钟，`requestVideoFrameCallback` 仅在新解码帧到达时上传视频纹理，`requestAnimationFrame` 复用最近纹理连续合成运镜、字幕、波纹与播放头。该双循环兼容 VFR/静态画面省帧，暂停、片尾、尾部裁剪与卸载时必须同时取消。
- 预览性能：普通编辑模式提供自动、流畅、高清、超清四档本机偏好，分别结合舞台尺寸与 `1x/1.5x/2x` 像素比把 WebGL backing 限制在 720p/1080p/1440p；自动档跟随当前 DPR，Retina 最高 1080p、普通屏最高 720p。专注预览继续独立按 `devicePixelRatio`（最高 2）补足物理像素，且不超过最终输出尺寸与 2560×1440。两种模式均使用 64px 宽度桶化，避免窗口尺寸变化时逐像素重建合成器。普通编辑显示刷新路径只在 ref 中统计呈现率：连续播放预热 3 秒后以 2 秒窗口判断，低于源 FPS 70% 时通过顶部居中 Sonner Toast 询问是否切换到流畅；暂停、seek、后台、专注预览和流畅档均重置或停用检测。预览上传纹理限制为 backing 长边的 1.5 倍，2K/4K 源只在 rVFC 报告新解码帧时上传；rAF 合成不得重复上传源纹理。波纹按输出比例缩放，导出分辨率与效果不受影响。播放头逐帧位置直接写 DOM，React 时间文本最多 20fps；`RenderInfo` 仅在内容变化时更新。
- 专注预览：macOS/Windows 共用当前 `PreviewPlayer`、隐藏视频源和 WebGL 合成器，在当前 Lenza 窗口内隐藏编辑工具栏、检查器与完整时间轴，只挂载只读悬浮播放控制；强制使用 fit 容器语义，不继承普通编辑的 `100%` 滚动状态。控制栏可通过白名单 IPC 查询、订阅并切换 BrowserWindow 最大化状态：Windows 铺满任务栏外工作区，macOS 铺满菜单栏/Dock 外工作区，均不进入原生全屏或创建新 Space；还原由 BrowserWindow 恢复此前窗口边界。进入专注预览时记录窗口最大化状态，所有退出路径先通过幂等 IPC 恢复该状态再显示编辑器，防止临时最大化泄漏。`F` 进入/退出、`Space` 播放/暂停、`Esc` 退出，模式为 Renderer 临时状态且不写入 `edit.json`。
- 按键回显：历史普通字符在派生层隐藏，450ms 内的旧修饰键序列可恢复为组合；提示持续 1.5s，新提示替换旧提示并淡入淡出。活动提示用二分查询，文字位图按组合缓存，内容不变时不重复上传 GPU；全局归一化位置可在预览画布拖动，并由同一 WebGL pass 供预览和导出使用。
- 时间轴事件轨：按像素密度档位把键帽降级为圆点/聚合点，Hover 保留完整名称和时间；DOM 只创建可视区及左右各一屏缓冲内的事件，滚动进入时创建、离开缓冲后卸载。滚轮缩放仅在跨密度档位时重新聚合，播放头逐帧推进不驱动静态事件轨重渲染。
- 合成顺序：可选纯色背景 → 保持真实矩形边缘的视频画面 → 光标（矢量，可缩放/替换）→ 点击波纹 → 按键回显 → 字幕 → webcam 画中画。字幕由 `src/render/captionOverlay.ts` 在 Canvas2D 生成位图，普通/专注预览和导出 Worker 共用同一段查询、换行、安全区、样式、位置及淡入淡出算法。背景关闭时 padding 为 0，输出计划的有效底色强制回到 `#16181D`，不得继续用持久化的最后选色填充透明留白；重新开启后仍恢复该选色。开启时源画面等比居中，画面边距可在 `0%–20%` 间按 `1%` 调整，默认 `6%`，实际像素以输出画布短边为基准计算。该基准摆放矩形同时作为固定内容裁剪窗口，运镜缩放和平移不得覆盖窗口外背景。预览和导出统一消费输出计划中的 `paddingRatio` 与有效底色，合成器不得强制添加圆角或阴影。

### 4.3 光标重绘（方案 B 落地后启用）

- 录制轨迹先做**平滑处理**：去抖（最小移动阈值）+ 样条插值（catmull-rom）
- 光标用 SVG/高分辨率位图按 DPR 缩放渲染，支持换皮肤

### 4.4 导出管线（Worker 线程，离线确定性渲染）

```
events.json + 相机关键帧
        │
   时间轴驱动器（t = 0, 1/60, 2/60 ...）
        │
   WebGL 逐帧渲染到 OffscreenCanvas
        │
   VideoEncoder (h264, 逐帧喂 VideoFrame)
        │
   mp4-muxer.js 封装 → Blob → 写盘
   音频：mic.wav 直接混入（AudioEncoder 或 ffmpeg.wasm）
```

要点：
- **导出不走实时**：帧时间戳由时间轴驱动，渲染慢没关系，保证输出帧率恒定
- **非破坏式裁剪**：`src/timeline/cuts.ts` 维护"丢弃区间"列表（源时间轴 ms，仅存内存，不改 events.json/视频）；预览播放 seek 跳过、导出按 输出帧→源帧 映射（`outputToSourceMs`）逐帧渲染，音频 PCM 按同一映射拼接（`cutPcm`），音画不漂移
- **字幕生成与开关**：新录像字幕默认关闭，`captions.json.enabled` 按会话持久化；关闭时预览、导出、字幕轨和操作区均不消费字幕，已有数据保留。Whisper Small 与约 0.9MB Silero VAD 随安装包内置、离线可用，首次开启直接本地生成；本地 helper 使用 `--vad --max-len 1` 取得真实发声区间和词级时间戳，再由 `shared/transcription.ts` 按停顿、标点、长度与时长重组为一句一条；关闭开关会取消未完成推理。
- **字幕导入与导出**：启用时导出 Worker 按输出帧映射回源时间查询字幕，并复用预览位图渲染；SRT 导入按原始录像时间轴解析并确认替换，SRT 导出由纯函数投影到裁剪后的输出时间轴，跨裁剪区间按保留段拆分。字幕文字、区间、样式与位置统一经历 pending → saving → saved/error 的原子自动保存状态。
- **后台导出队列**：导出任务在点击时冻结编辑快照，由应用级 Store 以单 Worker 串行调度；详情页卸载、会话切换和窗口隐藏不终止任务。根组件显示可折叠全局进度与队列，真正退出应用时若有任务则确认取消。Main 将完整产物直接写入 `AppSettings.exportPath`（默认 `Videos/Lenza/Exports`）或单次选择目录，以 `wx` 排他创建和 `name (n).ext` 递增命名保证不覆盖；H.264 不可用时仍按实际 `.webm` 保存。
- **动态输出尺寸**：背景关闭时优先按源视频偶数宽高编码，背景开启时目标为 1920×1080；`probeVideoEncoder` 按 H.264/VP9 探测，不支持目标尺寸时保持宽高比逐级降档到最大可用偶数尺寸，OffscreenCanvas、VideoEncoder、muxer 与按键覆盖层必须使用同一个最终尺寸，并把实际尺寸回传 UI。
- `mp4-muxer` 纯 JS 封装 H.264，无需 ffmpeg；AAC 音频用 WebCodecs `AudioEncoder`（mic.wav 缺失/编码不支持则无音轨继续）
- H.264 全部探测失败时 fallback VP9+webm（mediabunny `Output`/`WebMOutputFormat` 封装；webm 容器不支持 AAC，音轨走 opus）
- 输出全程在内存（`ArrayBufferTarget`/`BufferTarget`），完成后经 Renderer 弹保存对话框落盘；取消 = `worker.terminate()`，无半成品文件

---

## 5. 技术选型清单

| 模块 | 选型 | 备注 |
|---|---|---|
| 框架 | Electron + React + TypeScript + Vite（electron-vite） | |
| 屏幕采集 | desktopCapturer + getDisplayMedia | 原生 helper 走 v2 |
| 全局输入 | uiohook-nap + `screen.getCursorScreenPoint` 轮询 | |
| 渲染 | 自研 WebGL 或 PixiJS | 运镜合成 |
| 视频解码 | WebCodecs VideoDecoder + mediabunny（demux webm/mp4） | |
| 编码/封装 | WebCodecs VideoEncoder + mp4-muxer | |
| 状态管理 | zustand | 简单够用 |
| UI | Tailwind + shadcn/ui | |

> 注意：WebCodecs 在 Electron（Chromium）里可用，H.264 编码需要确认当前 Electron 版本的 openh264/平台硬编支持，fallback 是 VP9+webm 或 ffmpeg.wasm。

---

## 6. 项目结构建议

```
screen-recorder/
├── electron/                 # Main 进程
│   ├── capture/              # 屏幕/音频采集
│   ├── displaySelectionOutline/ # macOS/Windows 物理显示器选中边框
│   ├── input/                # 鼠标轨迹轮询、uiohook 事件
│   └── store/                # 录制会话落盘
├── src/                      # Renderer
│   ├── components/           # UI
│   ├── timeline/             # 事件模型、自动关键帧生成
│   ├── render/               # 虚拟相机 + WebGL 合成器（预览/导出共用）
│   └── export/               # Worker 导出管线
├── docs/TECH_DESIGN.md
└── package.json
```

---

## 7. 里程碑规划

| 阶段 | 目标 | 验收标准 |
|---|---|---|
| M1 采集底座 | 选屏录制 + 鼠标轨迹/点击同步记录 + 落盘 events.json | 录 1 分钟，事件与视频时间轴对齐误差 < 50ms |
| M2 回放运镜 | 读取录制会话，自动缩放 + spring 相机预览播放 | 点击处自动 zoom，动画平滑 |
| M3 导出 | Worker 离线逐帧渲染导出 mp4 | 1080p60 输出，与预览一致 |
| M4 光标美化 | 原生 helper 采集无光标画面 + 矢量光标重绘 | 光标可放大/换肤，轨迹平滑 |
| M5 编辑器 | 可手动调关键帧、删片段、webcam 画中画、按键回显 | 完整 MVP 闭环 |

---

## 8. 已知风险

1. **光标烧录**：见 §3.2，决定产品上限，尽早做原生 helper 的 PoC
2. ~~macOS 系统声音~~（已解决，见 §3.4：原生 helper `native/sck-audio` 走 ScreenCaptureKit 回采；loopback 在 macOS 上不可用，electron#52738）
3. **WebCodecs H.264**：不同 Electron 版本/平台支持不一，需探测 + fallback
4. **高分辨率性能**：5K 屏幕录制 + WebGL 合成注意纹理尺寸上限和显存
5. **权限**：macOS 需屏幕录制权限 + 辅助功能权限（全局输入钩子），要在引导页处理

## 9. 分发与打包

- 打包工具：electron-builder（配置 `electron-builder.yml`），本地 `npm run dist`，产物输出 `release/`。
- CI 流水线：`.github/workflows/release.yml`，打 tag `v*`（或手动 workflow_dispatch）触发，matrix 双平台：
  - **macOS**（macos-latest）：Swift 工具链 runner 自带，另安装 CMake → `npm run build:native` 编 `sck-audio`、`whisper-caption` 并下载内置字幕模型（Small + VAD）→ dmg。
  - **Windows**（windows-latest）：`dtolnay/rust-toolchain@stable` 装 cargo，另安装 CMake → `npm run build:native` 编 `wasapi-audio.exe`、`whisper-caption.exe` 并下载内置字幕模型（Small + VAD）→ NSIS 安装包。
  - tag 触发时由 `softprops/action-gh-release` 自动发布 GitHub Release 并附双平台产物。
- **原生 helper 与内置模型随包分发**：electron-builder `extraResources` 把系统音频 helper 放到 `resourcesPath` 根（mac: `sck-audio`，win: `wasapi-audio.exe`），把字幕 helper 目录放到 `resourcesPath/whisper-caption/`（mac: `whisper-caption`，win: `whisper-caption.exe` 与所需 DLL），把内置字幕模型放到 `resourcesPath/whisper-models/`（双平台均为 `ggml-small.bin` + `ggml-silero-v6.2.0.bin`），把 TTS helper 目录放到 `resourcesPath/tts-helper/`（mac: `tts-helper` + `libsherpa-onnx-c-api.dylib` + `libonnxruntime.1.17.1.dylib`，win: `tts-helper.exe` 与所需 DLL），把三套内置 TTS 模型放到 `resourcesPath/tts-models/`（`kokoro-int8-multi-lang-v1_1/`、`matcha-icefall-zh-baker/`、`kokoro-en-v0_19/`）；分别与 `electron/capture/systemAudio/`、`electron/transcription/`、`electron/tts/` 的平台文件查找路径一一对应。字幕 helper 由 `native/whisper-caption/build.mjs` 固定构建 whisper.cpp v1.9.0，TTS helper 由 `native/tts-helper/build.mjs` 基于 sherpa-onnx v1.12.20 官方预编译包编译跨 Kokoro/Matcha/VITS 的 CLI（darwin 直调 clang++，win32 走 cmake）；模型分别由两个 `fetch-models.mjs` 按 `shared/captionModels.json` / `shared/ttsModels.json` 清单下载并做全部核心文件大小 + SHA-1 校验（都挂在 `npm run build:native` 下）。Release 使用 `LENZA_REQUIRE_CAPTION_HELPER=1` 与 `LENZA_REQUIRE_TTS_HELPER=1`，缺少 CMake、helper 产物或任一必需模型资源时直接失败，避免发布残包。
- `uiohook-napi`（N-API 预编译）经 `asarUnpack` 从 asar 解出，否则无法加载。
- 产物**未签名**：macOS 需右键打开绕过 Gatekeeper；Windows 可能触发 SmartScreen。后续如有证书可在 CI 注入 `CSC_LINK` / `CSC_KEY_PASSWORD` 开启签名。

### 8.1 应用更新

- 更新检查由 Main 的 `electron/updater/` 单例负责，Renderer 只能通过 `shared/ipc.ts` 与 preload 白名单读取状态和触发操作。启动约 10 秒后按 `settings.json` 的 `autoCheckUpdates` 检查一次正式 GitHub Release；录制期间延期，且更新绝不主动停止录制。
- Windows 使用 `electron-updater` + NSIS：用户在弹层确认后才下载，下载完成后仍需用户点击“重启并安装”；录制期间 Main 拒绝安装。
- macOS 当前没有 Developer ID 签名与 notarization，因此只检查版本并打开精确 GitHub Release，禁止应用内下载/替换；ad-hoc/self-signed 不视为正式更新签名。取得证书后才能开放应用内安装。
- `electron-builder.yml` 的 GitHub provider 生成 `app-update.yml`；Release 发布 Windows 安装包、`latest.yml`、blockmap，以及 macOS DMG、ZIP、`latest-mac.yml`、blockmap。tag 的 `vX.Y.Z` 必须与 `package.json` 版本一致。
- Windows 首次安装使用 electron-builder 默认 assisted NSIS 脚本，`build/installer.nsh` 只通过官方 include 宏增加 Lenza 欢迎页；用户可选择安装范围和目录。不得用完整自定义 script 替换默认安装器，以免破坏 `electron-updater` 的覆盖安装参数。
- 应用设置 schema 为 V2，在原主题、录制根、回收站和关闭策略之外包含 `autoCheckUpdates` 与 `previewQuality`；旧设置缺字段时分别默认补 `true` 和 `auto`，非法预览档位同样回退 `auto` 并保留其他字段。
- 本机直连 GitHub 受限时（electron-builder 下载 NSIS/winCodeSign 超时），设 `ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/` 再跑 `npm run dist`；CI runner 无需此设置。
