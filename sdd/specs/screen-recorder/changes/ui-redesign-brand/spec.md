---
id: "ui-redesign-brand"
kind: change
parent: "screen-recorder"
status: completed
impact_radius:
  - "src/components/"
  - "src/App.tsx"
  - "src/index.css"
  - "tailwind.config.js"
  - "electron/main/"
  - "electron-builder.yml"
  - "build/"
  - "scripts/patch-electron-name.mjs"
  - "docs/design/"
---

# Change: UI 重构与 Lenza 品牌落地

## 背景

早期 UI 为默认 zinc 调试风格（"页面太难看"）。本 change 以高保真 HTML 设计稿
（`docs/design/mockup/` + record-view.png / editor-view.png）为蓝本完成全量重构，
并确立产品品牌 **Lenza（灵镜）**：lens 镜头 + 灵（自动运镜）。

## Functional Requirements

### ADDED

#### Requirement: 深色设计体系
The system SHALL 使用统一设计令牌：单一强调色 #FF5C38、surface 1-3 层背景、ink 1-3 档文字、
line 两级描边、12px/8px/全圆角三级圆角，令牌集中于 tailwind.config.js，组件库
（Button/Switch/Slider/Segmented/Chip/icons）从令牌派生。

##### Scenario: 新增 UI 组件
- **WHEN** 开发新界面元素
- **THEN** 复用组件库与令牌，不引入第二套颜色/圆角体系

#### Requirement: 录制页重构
The system SHALL 提供：权限状态胶囊行（授权/未授权一眼可读）、屏幕/窗口分组卡片式选源
（选中角标）、底部录制坞（麦克风开关、系统音频状态、录制/停止按钮、上次录制直达预览）。

##### Scenario: 选择采集源
- **WHEN** 用户进入录制页
- **THEN** 屏幕与窗口分区展示缩略图，选中项带强调色描边与「已选择」角标

##### Scenario: 录制计时
- **WHEN** 录制中切换视图再返回
- **THEN** 计时从 recordingStartedAt 推导，不归零（组件重挂载不丢状态）

#### Requirement: 预览编辑器布局
The system SHALL 采用三段布局：顶部工具栏（会话标识/导出）、中央 WebGL 舞台 + 右侧检查器、
底部时间轴；窗口最小宽高 1080×700，该尺寸下检查器/时间轴不溢出。

##### Scenario: 窗口缩至下限
- **WHEN** 用户将窗口拖到最小
- **THEN** 检查器内容完整可见（不横向溢出），时间轴可正常使用

#### Requirement: 品牌与窗口形态
The system SHALL 以 Lenza 为产品名（同步点：index.html title、App.tsx 标题、
electron-builder.yml productName/shortcutName、electron/main APP_NAME），
macOS 使用 hiddenInset 无边框窗口 + 拖拽区，Windows 保留原生标题栏；
图标以 build/icon.svg 为源，产出 icon.icns/icon.ico/icon.png 供 electron-builder 按约定拾取。

##### Scenario: 开发模式运行
- **WHEN** macOS 上 `npm run dev`
- **THEN** 菜单栏与 Dock 悬停显示 Lenza、Dock 显示应用图标
  （app.setName + dock.setIcon 覆盖；postinstall 脚本 patch-electron-name.mjs 改写
  Electron.app 的 CFBundleName/CFBundleDisplayName）

##### Scenario: 打包分发
- **WHEN** `npm run dist` 产出 dmg/NSIS
- **THEN** 应用名/图标由 electron-builder 从 productName 与 build/icon.* 生成，无需手工介入

## 设计约束

- 不改动采集/录制语义与 events.json 格式，纯表现层重构
- 无边框窗口的平台差异只在 electron/main/index.ts 一处分发（darwin hiddenInset / 其他 default）
- 图标源文件为 SVG，禁止位图手改多份；尺寸产物由脚本渲染生成
