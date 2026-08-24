# Task Breakdown & Execution Board: 窗口录制固定画布与动态几何 (Tasks)

## Phase 1: 契约与纯函数

- [x] Task 1.1: 定义 events.json V1/V2 联合类型、窗口 geometry 样本、source/fixedCanvas 字段及 V1→内部模型兼容归一化。
- [x] Task 1.2: 实现按时间插值 geometry、固定画布 placement、屏幕点→画布点与窗口外过滤纯函数，并覆盖多屏负坐标和 DPI 场景。
- [x] Task 1.3: 让关键帧、鼠标跟随、可编辑运镜和波纹统一复用新的来源坐标函数。

## Phase 2: 双平台窗口几何

- [x] Task 2.1: 定义 window-geometry helper JSON Lines 协议、启动/停止、相对时间戳、去重、异常与最近有效值策略。
- [x] Task 2.2: 实现 macOS Swift helper，按 desktopCapturer window id 查询 CoreGraphics/ScreenCaptureKit 窗口 bounds。
- [x] Task 2.3: 实现 Windows Rust helper，按 HWND 查询 DWM/Win32 物理窗口 bounds，并处理 Per-Monitor DPI。
- [x] Task 2.4: 实现 `electron/capture/windowGeometry/{index,darwin,win32}.ts` 平台分发和录制生命周期接入。

## Phase 3: 固定画布采集

- [x] Task 3.1: 实现窗口录制 TrackProcessor Worker：固定 OffscreenCanvas、等比 placement、VideoFrame 时间戳保留、帧 close 与背压。
- [x] Task 3.2: ScreenRecorder 仅对 window 来源启用归一化生成轨，screen 来源继续使用原始轨；停止/异常时完整释放 Worker、轨和帧。
- [x] Task 3.3: Main 按开始窗口所在显示器冻结物理 fixedCanvas，并把 geometry/source 写入 events.json V2。
- [x] Task 3.4: 处理最小化、零尺寸、跨屏、快速 resize、helper/Worker 不可用和来源关闭降级。

## Phase 4: 构建、预览与导出集成

- [x] Task 4.1: 更新 native 构建、electron-builder extraResources 和 release workflow，双平台分发 window-geometry helper。
- [x] Task 4.2: 更新会话加载、预览和导出，使 V2 固定画布、坐标与现有背景/裁剪/音频链路一致。
- [x] Task 4.3: 同步 `docs/TECH_DESIGN.md` 的采集语义、events.json V2、平台路径和固定画布性能边界，并注册 SDD 状态。

## Phase 5: 验证

- [x] Task 5.1: 增加 geometry 插值、placement、窗口外过滤、V1 兼容、负坐标/DPI 和 resize 序列 smoke。
- [x] Task 5.2: 运行 typecheck、lint、build、native build 与既有 render/export/capture smoke。
- [ ] Task 5.3: macOS/Windows 实机各录制：移动、缩放、最大化、还原、跨屏、最小化、来源关闭；核对波纹/运镜/跟随及预览导出一致性。
- [ ] Task 5.4: 在 2K 显示器验证 screen.webm 与 MP4 全程恒定分辨率、60fps、内存稳定和无明显录制掉帧。

# Task Dependencies

- [Task 1.2] depends on [Task 1.1]
- [Task 1.3] depends on [Task 1.2]
- [Task 2.2] and [Task 2.3] depend on [Task 2.1] and can run in parallel
- [Task 2.4] depends on [Task 2.2] and [Task 2.3]
- [Task 3.1] depends on [Task 1.2]
- [Task 3.2] depends on [Task 3.1]
- [Task 3.3] depends on [Task 1.1], [Task 2.4] and [Task 3.2]
- [Task 3.4] depends on [Task 2.4] and [Task 3.2]
- [Task 4.1] depends on [Task 2.2] and [Task 2.3]
- [Task 4.2] depends on [Task 1.3] and [Task 3.3]
- [Task 4.3] depends on [Task 4.1] and [Task 4.2]
- [Task 5.1] depends on [Task 1.3] and [Task 3.4]
- [Task 5.2] depends on [Task 4.1], [Task 4.2] and [Task 5.1]
- [Task 5.3] and [Task 5.4] depend on [Task 5.2] and can run in parallel
