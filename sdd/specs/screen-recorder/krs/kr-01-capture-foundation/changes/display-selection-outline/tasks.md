# Task Breakdown & Execution Board: 物理显示器选中边框

## Phase 1: 共享契约与平台模块

- [x] Task 1.1：在 `shared/ipc.ts` 与 preload 白名单中增加显示/隐藏边框接口，保持类型在 Main/Renderer 间唯一。
- [x] Task 1.2：建立 `electron/displaySelectionOutline/` 平台分发模块，实现 source `display_id` 到 Electron `Display` 的精确解析和单实例生命周期。
- [x] Task 1.3：分别实现 `darwin.ts` 与 `win32.ts` 的透明、不可聚焦、鼠标穿透、置顶覆盖窗口，并使用稳定橙色内描边。
- [x] Task 1.4：拆分辅助窗口的任务栏策略：macOS 不使用会改变应用激活策略的 `skipTaskbar`，Windows 保持辅助窗口从任务栏/Alt+Tab 隐藏。
- [x] Task 1.5：移除 macOS `setVisibleOnAllWorkspaces` 的应用级进程类型转换，并将辅助窗口排除出 Mission Control 与窗口菜单。

## Phase 2: 生命周期集成

- [x] Task 2.1：在 Main IPC 中注册显示/隐藏处理器，并在显示器移除、尺寸变化、主窗口隐藏/关闭及应用退出时清理或更新覆盖层。
- [x] Task 2.2：在 `appStore.selectSource` 中联动整屏显示、窗口隐藏及采集失败清理，处理快速连续改选只保留最后请求。
- [x] Task 2.3：在离开录制视图时隐藏边框，并在开始录制路径中先等待隐藏完成再启动录制。

## Phase 3: 文档与自动验证

- [x] Task 3.1：同步 `docs/TECH_DESIGN.md` §3.1 的来源选择反馈、平台路径与录制前清理顺序。
- [x] Task 3.2：运行 `npm run typecheck`、`npm run build`、相关 lint 与 `git diff --check`，确认单文件不超过 300 行。
- [x] Task 3.3：完成任务栏策略修复后重新运行类型检查、构建、相关 lint 与 `git diff --check`。

## Phase 4: 人工冒烟

- [x] Task 4.1：macOS 双屏验证选择、改选、窗口来源、鼠标穿透、主窗口隐藏、屏幕拔插及首帧无边框。
- [ ] Task 4.2：Windows 双屏验证选择、改选、窗口来源、鼠标穿透、任务栏/Alt+Tab 隐藏、屏幕拔插及首帧无边框。

# Task Dependencies

- [Task 1.2] depends on [Task 1.1]
- [Task 1.3] depends on [Task 1.2]
- [Task 1.4] depends on [Task 1.3]
- [Task 1.5] depends on [Task 1.4]
- [Task 2.1] depends on [Task 1.2] and [Task 1.3]
- [Task 2.2] depends on [Task 1.1] and [Task 2.1]
- [Task 2.3] depends on [Task 2.2]
- [Task 3.1] depends on [Task 2.1] and [Task 2.3]
- [Task 3.2] depends on [Task 3.1]
- [Task 3.3] depends on [Task 1.5]
- [Task 4.1] and [Task 4.2] depend on [Task 3.2] and [Task 3.3] and can run in parallel
