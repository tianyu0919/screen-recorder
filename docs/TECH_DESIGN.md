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
| 背景构图 | 录制画面居中 + 四周渐变 padding | 录制分辨率 |
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

- 源枚举：`desktopCapturer.getSources({ types: ['screen', 'window'] })`

> **窗口源的固有语义（产品决策，2026-08-19 冒烟确认）**：窗口采集锁定的是"选定那一刻的窗口"，目标 App 在录制期间新弹出的窗口录不上。因此产品定为**整屏主模式**，窗口模式仅限单窗口演示场景；App 级采集（SCApplication 粒度，跟随整个 App 的全部窗口）留给原生 helper（kr-04），记 backlog。
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
- **点击/键盘事件**：需要全局钩子，用 [`uiohook-napi`](https://www.npmjs.com/package/uiohook-napi)（原 uiohook-nap 已被作者更名为此包；维护中的 iohook 替代品，N-API 预编译免 rebuild，支持 macOS/Win/Linux）。记录 mousedown/up、keypress。
- 多屏/缩放：记录事件时同时记录 `display.id`、`scaleFactor` 和屏幕 bounds，渲染期做坐标换算。

### 3.4 音频

- 麦克风：`getUserMedia({ audio: true })`，单独一条轨
- 系统声音（kr-01 system-audio 已落地）按平台分路径，产物都是 `system.wav`（48kHz/2ch/int16，与 mic.wav 同规格），预览/导出期与 mic.wav 混合：
  - **双轨回声对齐**：音箱外放时 mic 轨会 acoustically 录入系统音，与 system.wav 混合形成回声；两条采集链有固定延迟差（声卡/Voicemeeter 引擎缓冲，逐机不同，实测 ~183ms）。预览（useSyncedAudio 偏移播放）与导出（mixPcm 偏移混合）统一用 `src/lib/audioAlign.ts` 的降采样互相关估计 system 相对 mic 的恒定偏移并对齐；归一化相关度不足（耳机用户 mic 无系统音）→ 偏移 0 不对齐。
  - **macOS**：loopback 轨在 macOS 上出生即 ended、电平恒 0（electron#52738），不可用。走原生 helper：Main 在录制开始时 spawn `native/sck-audio`（Swift + ScreenCaptureKit，`capturesAudio` + `excludesCurrentProcessAudio`，全系统音频回采），流式写 `system.wav`。首次运行会触发 macOS「屏幕与系统音频录制」TCC 授权。
  - **Windows**：Renderer loopback + MediaRecorder 路径有杂音（Chromium 回环采样率不匹配爆音 + 默认低码率 Opus 失真），已弃用。走原生 helper：Main spawn `native/wasapi-audio`（Rust + WASAPI shared-mode loopback，采默认渲染设备混音，float32 → int16，非 48k 设备用 rubato sinc 重采样；>2ch 设备取 ch0/ch1 主立体声），流式写 `system.wav`。
    - **VB-Audio 虚拟设备绕行（Voicemeeter/VB-Cable 用户）**：VB 虚拟渲染设备（"Voicemeeter Input" 等）的 loopback tap 返回全零（驱动怪异行为，Chromium 同样中招）。helper 检测到默认渲染设备是 VB 虚拟设备时，自动改采对应的总线镜像采集端点（"Voicemeeter Input" → "Voicemeeter Out B1"、AUX → B2、VAIO3 → B3、"CABLE Input" → "CABLE Output"），并通过 Voicemeeter Remote API 临时打开虚拟输入条带的 Bx 路由（仅作用于引擎运行时不写用户配置，录制结束恢复原值；Remote 指令需保持登录 ~800ms 才下发）。绕行产生的启动延迟会补等长静音，保持 system.wav 与画面 t=0 对齐。
  - **其他平台**：Main 分发返回 null，由 Renderer 侧 loopback 兜底——`setDisplayMediaRequestHandler` 回调带 `audio: 'loopback'` + `getDisplayMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })` 拿回采轨，**必须关闭语音处理**；画面 MediaRecorder 只用 video track 建新流，系统音频不混入 screen.webm；单独 MediaRecorder 落盘 system.wav。不支持的平台静默无音轨。
  - helper 统一协议：录制停止时 Main 关闭 helper stdin（EOF）通知其 patch WAV header 后退出，2s 超时强杀兜底（macOS 实测 DispatchSourceSignal 在挂了 SCStream 的进程里不触发，SIGTERM 仅作兜底）。helper 缺失/启动失败静默降级为无系统音轨；helper 提前非零退出会清掉 header-only 残留，避免被当成有效音轨。helper 构建：`npm run build:native`（按平台分发：darwin 跑 swiftc，win32 跑 cargo）。

### 3.5 录制会话数据格式（落盘）

```
recordings/<session-id>/
├── screen.webm          # 原始屏幕画面（纯视频轨）
├── mic.wav              # 麦克风（可选）
├── system.wav           # 系统音频（可选，kr-01 system-audio）
├── webcam.webm          # 摄像头（可选）
└── events.json          # 元数据 + 事件流
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

---

## 4. 运镜渲染引擎（核心模块）

这是产品灵魂，预览和导出共用。

### 4.1 虚拟相机模型

- 把录制画面视为一张 `(W, H)` 的大画布，输出是 `1920×1080` 的视口
- 相机状态：`{ x, y, zoom }`（视口中心点 + 缩放倍率）
- **自动关键帧生成**：遍历点击事件，在每次点击前 ~200ms 生成"缩放到点击区域"的目标状态，无操作超过 N 秒回到 1.0x 全景。规则参数化（目标缩放倍率、停留时长、回归阈值）
- **相机动画**：关键帧之间用 spring 阻尼曲线插值（react-spring 的 spring 物理或手写 RK4），保证运动有"肉感"不生硬

### 4.2 渲染器

- **WebGL**（自研 shader 或用 PixiJS）：每帧根据相机状态对视频纹理做仿射变换 + 叠加层（光标、点击波纹、按键徽章）
- 视频解码：导出用 WebCodecs `VideoDecoder` 精确逐帧取帧；预览可用 `<video>` + `requestVideoFrameCallback`
- 合成顺序：背景渐变 → 视频画面（圆角 + 阴影）→ 光标（矢量，可缩放/替换）→ 点击波纹 → 按键回显 → webcam 画中画

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
  - **macOS**（macos-latest）：Swift 工具链 runner 自带 → `npm run build:native` 编 `sck-audio` → dmg。
  - **Windows**（windows-latest）：`dtolnay/rust-toolchain@stable` 装 cargo → `npm run build:native` 编 `wasapi-audio.exe` → NSIS 安装包。
  - tag 触发时由 `softprops/action-gh-release` 自动发布 GitHub Release 并附双平台产物。
- **原生 helper 随包分发**：electron-builder `extraResources` 把 helper 放到 `resourcesPath` 根（mac: `sck-audio`，win: `wasapi-audio.exe`），与 `electron/capture/systemAudio/{darwin,win32}.ts` 的 `app.isPackaged` 查找路径一一对应；改路径需三处同步。
- `uiohook-napi`（N-API 预编译）经 `asarUnpack` 从 asar 解出，否则无法加载。
- 产物**未签名**：macOS 需右键打开绕过 Gatekeeper；Windows 可能触发 SmartScreen。后续如有证书可在 CI 注入 `CSC_LINK` / `CSC_KEY_PASSWORD` 开启签名。
- 本机直连 GitHub 受限时（electron-builder 下载 NSIS/winCodeSign 超时），设 `ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/` 再跑 `npm run dist`；CI runner 无需此设置。
