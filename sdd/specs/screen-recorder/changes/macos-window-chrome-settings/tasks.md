# Task Breakdown & Execution Board: macOS 原生窗口顶栏与设置交互

## Phase 1: 平台行为

- [x] Task 1.1：调整 Main 窗口关闭分发，macOS 固定隐藏窗口，Windows 保留 `closeBehavior` 分支与首次确认。
- [x] Task 1.2：在设置界面按平台隐藏 macOS“关闭应用”区块，保留 Windows 原行为与共享设置契约。

## Phase 2: 设置抽屉交互

- [x] Task 2.1：为设置抽屉的遮罩、面板和交互控件补充 `app-nodrag` 边界，修复关闭按钮点击。
- [x] Task 2.2：实现 Escape 关闭并确保监听随打开状态注册、清理；验证遮罩点击不误触面板内容。

## Phase 3: macOS 顶栏设计

- [x] Task 3.1：提取或实现 macOS 专属标题工具栏，把更新、主题、设置放入红绿灯同行右侧，并保留中间拖拽区。
- [x] Task 3.2：调整下方品牌标题区和 Windows 顶栏分支，避免重复入口并保持双平台布局清晰。

## Phase 4: 文档与验证

- [x] Task 4.1：同步 `docs/TECH_DESIGN.md` 中 macOS/Windows 关闭生命周期与顶栏布局说明。
- [ ] Task 4.2：运行 typecheck、build、lint，并在 macOS 实际验证设置三种关闭方式、红灯隐藏/Dock 恢复、`⌘Q` 退出、深浅主题与窗口拖拽。

# Task Dependencies

- [Task 1.2] depends on [Task 1.1]
- [Task 2.2] depends on [Task 2.1]
- [Task 3.2] depends on [Task 3.1]
- [Task 1.1] and [Task 2.1] and [Task 3.1] can run in parallel
- [Task 4.1] depends on [Task 1.1] and [Task 3.2]
- [Task 4.2] depends on [Task 1.2], [Task 2.2], [Task 3.2], and [Task 4.1]
