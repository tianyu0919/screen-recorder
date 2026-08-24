---
id: "macos-window-chrome-settings"
kind: change
parent: "screen-recorder"
status: in_progress
impact_radius:
  - "electron/main/index.ts"
  - "src/App.tsx"
  - "src/components/settings/SettingsPanel.tsx"
  - "src/components/"
dependencies:
  - "session-library-settings"
  - "ui-modern-light-motion-refresh"
---

# Specification: macOS 原生窗口顶栏与设置交互

## 1. Scope

- **In Scope**: 设置抽屉关闭交互；macOS 原生关闭语义；macOS/Windows 设置项分发；macOS 顶栏空间重排；深浅主题、拖拽和键盘验证。
- **Out of Scope**: 修改 Windows 托盘能力；删除或迁移 `closeBehavior` 设置字段；Apple Developer ID 签名、公证；重做录制页和编辑器主体布局。

## 2. Functional Requirements

### ADDED

#### Requirement: 可可靠关闭的设置抽屉
系统 SHALL 在设置抽屉打开时提供关闭按钮、遮罩点击和 Escape 三种关闭方式，并防止 Electron 窗口拖拽区吞掉交互。

##### Scenario: 点击关闭按钮
- **WHEN** 用户点击设置抽屉右上角关闭按钮
- **THEN** 抽屉执行退出动画并从交互树中移除

##### Scenario: 使用遮罩或键盘关闭
- **WHEN** 用户点击抽屉外遮罩或按下 Escape
- **THEN** 抽屉关闭，且其他应用设置保持不变

##### Scenario: 关闭后清理监听
- **WHEN** 设置抽屉关闭或组件卸载
- **THEN** 系统移除 Escape 监听，不影响页面其他快捷键

#### Requirement: macOS 原生工具栏布局
系统 SHALL 在 macOS 红绿灯所在行右侧展示软件更新、主题切换和应用设置入口，中间区域保持可拖动；品牌信息位于下方内容标题区。

##### Scenario: macOS 顶栏展示
- **WHEN** 应用运行于 macOS
- **THEN** 顶部不再出现独立空白红绿灯行，右侧三个工具入口可点击，按钮区域不会触发窗口拖动

##### Scenario: Windows 顶栏展示
- **WHEN** 应用运行于 Windows
- **THEN** 保留品牌、工具入口和最小化/最大化/关闭自绘控件，macOS 专属布局不渲染

##### Scenario: 主题与尺寸
- **WHEN** 用户切换深浅主题或将窗口缩放至允许的最小尺寸
- **THEN** 顶栏保持清晰、无重叠，拖拽区和工具按钮均可用

### MODIFIED

#### Requirement: 跨平台关闭行为
系统 SHALL 在 macOS 点击红色关闭按钮时始终隐藏主窗口并保留应用于 Dock，通过 Dock 激活恢复；仅 `⌘Q` 或菜单栏退出结束应用。Windows 继续支持“后台运行 / 直接退出”确认与持久化设置。

##### Scenario: macOS 关闭窗口
- **WHEN** macOS 用户点击红色关闭按钮，即使历史设置中 `closeBehavior` 为 `quit`
- **THEN** 主窗口隐藏，应用保持运行，Dock 激活恢复同一窗口

##### Scenario: macOS 退出应用
- **WHEN** macOS 用户按 `⌘Q` 或选择菜单栏“退出 Lenza”
- **THEN** 应用正常结束，不被窗口隐藏逻辑拦截

##### Scenario: Windows 关闭窗口
- **WHEN** Windows 用户关闭窗口
- **THEN** 系统继续根据已保存策略执行托盘后台或直接退出；未保存时显示首次确认

#### Requirement: 应用设置界面
系统 SHALL 按平台展示关闭设置：Windows 显示“关闭应用”，macOS 隐藏该区块，其余设置项与保存行为保持一致。

##### Scenario: macOS 设置界面
- **WHEN** macOS 用户打开应用设置
- **THEN** 不显示“后台运行 / 直接退出”选择，不修改已有 `closeBehavior`

##### Scenario: Windows 设置界面
- **WHEN** Windows 用户打开应用设置
- **THEN** 正常显示并可修改关闭行为

### REMOVED

#### Requirement: macOS 可选择直接退出
**Reason**: 红色关闭按钮与退出应用混用不符合 macOS 原生交互，并会让用户意外结束常驻 Dock 的应用。
**Migration**: 保留磁盘中的 `closeBehavior` 字段供 Windows 使用；macOS 运行时忽略该字段，不执行数据迁移。
