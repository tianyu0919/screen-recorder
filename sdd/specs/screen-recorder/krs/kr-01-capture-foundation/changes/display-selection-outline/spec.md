---
id: "kr-01-display-selection-outline"
kind: change
parent: "kr-01-capture-foundation"
status: in_progress
impact_radius:
  - "electron/displaySelectionOutline/"
  - "electron/ipc.ts"
  - "electron/main/index.ts"
  - "electron/preload/index.ts"
  - "shared/ipc.ts"
  - "src/store/appStore.ts"
dependencies:
  - "kr-01-capture-foundation"
  - "ui-modern-light-motion-refresh"
---

# Specification: 物理显示器选中边框

## 1. Scope

- **In Scope**: macOS/Windows 整屏来源的物理显示器边框；来源到显示器的精确映射；改选、失败、视图切换、窗口生命周期、显示器拓扑变化与录制启动前的清理；深浅桌面可见性和鼠标穿透。
- **Out of Scope**: 窗口来源的外框标记；文字标签或屏幕编号；呼吸/闪烁动效；把边框写入录制会话；Linux 支持；改变现有来源卡片选中样式。

## 2. Functional Requirements

### ADDED

#### Requirement: 精确标记选中的物理显示器
系统 SHALL 在 macOS 或 Windows 用户选择整屏来源后，使用该来源的 `display_id` 精确匹配物理显示器，并在该显示器最外沿显示稳定、明显的 Lenza 橙色边框。

##### Scenario: 选择整屏来源
- **WHEN** 用户在录制页选择可用的“屏幕 1”等整屏来源
- **THEN** 对应物理显示器四周出现常亮边框，且不显示标签、图标或闪烁动画

##### Scenario: 改选另一显示器
- **WHEN** 用户从一块屏幕改选另一块屏幕
- **THEN** 旧显示器边框消失，新显示器边框出现，系统中最多存在一个选中边框

##### Scenario: 来源无法映射
- **WHEN** 所选 source 已失效或其 `display_id` 无法匹配当前显示器
- **THEN** 系统清除旧边框且不猜测目标显示器，既有采集错误流程继续处理来源失败

#### Requirement: 非侵入式跨平台覆盖层
系统 SHALL 使用不聚焦、鼠标穿透的辅助覆盖窗口绘制边框，并保持边框之外完全透明；辅助窗口本身不得成为独立的系统切换项，但不得改变 Lenza 主应用在 Dock、任务栏或应用切换器中的正常可见性。

##### Scenario: 操作被标记的显示器
- **WHEN** 边框正在目标显示器显示，用户点击、拖动或使用键盘操作其上的其他应用
- **THEN** 输入直接传递给原目标应用，Lenza 不抢焦点也不拦截事件

##### Scenario: 深浅内容与系统缩放
- **WHEN** 目标显示器展示浅色或深色内容，或使用非 100% 缩放
- **THEN** 四边描边均完整可见、位置准确且不产生大面积遮挡

##### Scenario: macOS 应用可见性保持
- **WHEN** macOS 用户选择整屏来源并显示辅助边框
- **THEN** Lenza 主应用继续显示在 Dock 和 `Command + Tab` 中，辅助边框窗口不单独出现在 Mission Control 或窗口菜单中，且系统不为辅助窗口转换整个应用的进程类型

##### Scenario: Windows 辅助窗口隐藏
- **WHEN** Windows 用户选择整屏来源并显示辅助边框
- **THEN** Lenza 主窗口继续显示在任务栏和 `Alt + Tab` 中，辅助边框窗口不产生额外任务栏按钮或切换项

#### Requirement: 完整的边框生命周期
系统 SHALL 在改选窗口来源、预览获取失败、离开录制页、主窗口隐藏/关闭、应用退出或目标显示器失效时清除选中边框。

##### Scenario: 改选窗口来源
- **WHEN** 用户从整屏来源改选应用窗口来源
- **THEN** 物理显示器边框立即消失，窗口来源不显示系统级外框

##### Scenario: 来源获取失败
- **WHEN** 整屏来源的预览流获取失败
- **THEN** 系统清除该来源对应的物理边框，不留下陈旧选中反馈

##### Scenario: 离开选择上下文
- **WHEN** 用户离开录制页、隐藏主窗口、退出应用或拔出被标记的显示器
- **THEN** 覆盖窗口被销毁，不在桌面残留

#### Requirement: 录制前排除选中边框
系统 SHALL 在启动录制会话和 `MediaRecorder` 写入前等待选中边框完成隐藏，确保输出视频不包含该提示。

##### Scenario: 点击开始录制
- **WHEN** 用户在整屏来源已被标记时点击“开始录制”
- **THEN** 边框先消失，随后才启动采集写入与录制计时

##### Scenario: 录制启动失败
- **WHEN** 边框已隐藏但后续录制启动失败
- **THEN** 系统展示既有录制错误且不自动恢复陈旧边框；用户可重新选择来源再次确认
