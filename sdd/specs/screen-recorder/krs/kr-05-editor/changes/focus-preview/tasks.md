# Task Breakdown & Execution Board: 跨平台专注预览

## Phase 1: 模式状态与布局

- [x] Task 1.1：在预览页增加非持久化专注预览状态，并在会话关闭或离开预览视图时安全复位。
- [x] Task 1.2：扩展预览布局，在专注模式下隐藏编辑器工具栏、检查器和完整时间轴，使画面占满当前窗口可用区域。

## Phase 2: 播放控制与交互

- [x] Task 2.1：复用现有 playback 状态与 seek 能力实现只读悬浮控制栏，避免创建第二套播放器或逐帧循环。
- [x] Task 2.2：实现播放时静止 2 秒自动淡出，以及鼠标移动、暂停、控制聚焦时恢复显示。
- [x] Task 2.3：实现跨平台 `F` 进入/退出、`Space` 播放/暂停与 `Esc` 退出，并避免在输入控件中拦截按键。
- [x] Task 2.4：确保进入/退出保持播放位置、播放状态、缩放模式与检查器布局，且专注模式不写入 `edit.json`。
- [x] Task 2.5：专注预览按最高 2 倍设备像素比提升 backing，1080p 输出使用完整分辨率，2K/4K 输出最高限制为 2560×1440。
- [x] Task 2.6：专注预览强制使用 fit 容器语义，隔离外部 `100%` 的滚动与固定尺寸样式。
- [x] Task 2.7：复用窗口最大化 IPC 并补充初始状态查询，在控制栏增加独立最大化/还原按钮且保持专注预览状态。
- [x] Task 2.8：进入专注预览时记录窗口最大化状态，退出时恢复该状态，避免专注模式内最大化泄漏到编辑模式。

## Phase 3: 验证与文档

- [x] Task 3.1：同步 `docs/TECH_DESIGN.md` 的编辑器预览布局与键盘交互说明。
- [x] Task 3.2：运行 `npm run typecheck`、`npm run build`、相关 lint 与 `git diff --check`，确认改动文件不超过 300 行。
- [ ] Task 3.3：分别在 macOS 与 Windows 冒烟进入/退出、播放、暂停、seek、自动隐藏、窗口缩放和会话切换。

# Task Dependencies

- [Task 1.2] depends on [Task 1.1]
- [Task 2.1] depends on [Task 1.2]
- [Task 2.2], [Task 2.3] and [Task 2.4] depend on [Task 2.1] and can run in parallel
- [Task 2.6] and [Task 2.7] depend on [Task 2.1] and can run in parallel
- [Task 3.1] depends on [Task 1.2] and [Task 2.3]
- [Task 3.2] depends on [Task 2.2], [Task 2.3], [Task 2.4] and [Task 3.1]
- [Task 3.3] depends on [Task 3.2]
