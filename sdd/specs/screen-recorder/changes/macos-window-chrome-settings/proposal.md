# Proposal: macOS 原生窗口顶栏与设置交互

## 1. Context & Problem Statement

- **Current State**: macOS 使用 `hiddenInset` 标题栏，但 Renderer 单独预留了 40px 红绿灯拖拽行，软件更新、主题和设置仍位于下一行，导致窗口顶部左侧红绿灯右方大面积空白。设置抽屉关闭按钮落在窗口拖拽区域上方时可能被 Electron 的 `app-region: drag` 吞掉。关闭行为设置同时展示于 Windows 和 macOS。
- **Pain Points**: macOS 顶部空间利用率低；设置抽屉缺少可靠的关闭交互；“后台运行 / 直接退出”不符合 macOS 关闭窗口与退出应用分离的原生心智。

## 2. Value Proposition

- 让红绿灯所在行成为真正的 macOS 工具栏，提高顶部空间利用率。
- 保证设置抽屉可以通过关闭按钮、遮罩和 Escape 稳定退出。
- 让 macOS 红色关闭按钮固定隐藏窗口、`⌘Q` 才退出，同时保留 Windows 托盘关闭策略。
- 平台差异显式分发，避免一个平台的关闭设置影响另一个平台。

## 3. Alternatives Considered

- **保留空白拖拽行**：实现最简单，但不解决顶部浪费和工具区割裂。
- **macOS 继续提供关闭策略选择**：功能更多，但违背 macOS 标准窗口生命周期，并让已保存的“直接退出”产生意外行为。
- **完全删除 `closeBehavior` 设置**：会破坏 Windows 托盘体验和既有设置契约，因此仅在 macOS 隐藏并忽略该字段。

## 4. Success Metrics

- [x] macOS 红绿灯行右侧稳定显示更新、主题和设置入口，且中间区域可拖动窗口。
- [x] 设置抽屉的关闭按钮、遮罩和 Escape 三种方式均可关闭。
- [x] macOS 红色关闭按钮只隐藏窗口，Dock 激活可恢复；`⌘Q` 完全退出。
- [x] Windows 关闭策略、首次询问和自绘窗口按钮无回归。
