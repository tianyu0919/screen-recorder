---
id: "kr-05-focus-preview"
kind: feature
parent: "kr-05-editor"
status: in_progress
impact_radius:
  - "src/components/preview/PreviewScreen.tsx"
  - "src/components/preview/PreviewPlayer.tsx"
  - "src/components/preview/PreviewLayoutControls.tsx"
  - "src/components/preview/"
dependencies:
  - "kr-05-preview-stage-fit"
  - "kr-05-render-composition-controls"
---

# Specification: 跨平台专注预览

## 1. Scope

- **In Scope**: macOS/Windows 编辑器内的专注预览；占满当前 Lenza 窗口；只读最终效果；简化悬浮播放控制；自动隐藏；跨平台键盘操作；进入与退出时恢复编辑上下文。
- **Out of Scope**: 操作系统原生全屏或独立预览窗口；修改导出分辨率；在专注预览中编辑裁剪、运镜、音频或背景；持久化专注预览状态。

## 2. Functional Requirements

### ADDED

#### Requirement: 当前窗口专注预览
系统 SHALL 在预览布局控制区提供“专注预览”入口，并在 macOS 与 Windows 上使用当前 Lenza 窗口最大化展示最终合成画面，而不进入操作系统全屏。

##### Scenario: 从编辑器进入
- **WHEN** 用户点击“专注预览”或按下 `F`
- **THEN** 系统隐藏顶部工具栏、右侧检查器和完整时间轴，并使合成画面在剩余窗口中按输出宽高比尽可能放大且完整可见

##### Scenario: 不改变系统窗口模式
- **WHEN** 用户进入专注预览
- **THEN** macOS 不创建新的全屏 Space，Windows 不隐藏系统任务栏，Lenza 窗口层级与尺寸保持由用户当前窗口状态决定

#### Requirement: 只读最终效果
系统 SHALL 在专注预览中只展示与导出一致的最终合成效果，不展示或启用编辑辅助元素。

##### Scenario: 检查最终效果
- **WHEN** 专注预览正在显示
- **THEN** 裁剪框、运镜控制点、选中框和其他编辑手柄均不可见且不可交互，音频、背景与运镜继续按当前编辑参数播放

#### Requirement: Retina 高清预览
系统 SHALL 在专注预览中按显示器像素比提高 WebGL backing 清晰度，同时保留普通编辑模式的性能降档。

##### Scenario: 1080p 输出与 Retina 显示器
- **WHEN** 专注预览显示 1920×1080 输出且显示器像素比大于 1
- **THEN** backing 最高使用完整 1920×1080，不把 720p 画面拉伸到专注舞台

##### Scenario: 2K/4K 输出
- **WHEN** 最终输出尺寸超过 1920×1080
- **THEN** 专注预览按舞台物理像素渲染，但最高限制为 2560×1440；普通编辑模式仍最高为 1280×720

#### Requirement: 简化播放控制
系统 SHALL 在专注预览底部提供悬浮的播放/暂停、简化进度条、当前时间/总时长与退出按钮。

##### Scenario: 鼠标与键盘控制
- **WHEN** 用户点击控制项、按下 `Space` 或拖动简化进度条
- **THEN** 播放状态或播放位置立即更新，且不修改编辑文档内容

##### Scenario: 自动隐藏控制栏
- **WHEN** 画面正在播放且鼠标静止并离开控制焦点 2 秒
- **THEN** 控制栏柔和淡出；鼠标移动、播放暂停或键盘焦点进入控制栏时重新显示

#### Requirement: 无损进入与退出
系统 SHALL 保留进入专注预览前的播放位置、播放状态和编辑器布局，并支持 `F` 或 `Esc` 退出。

##### Scenario: 保持播放上下文
- **WHEN** 用户在任意播放位置进入专注预览
- **THEN** 系统不自动跳到开头，并延续进入前的播放或暂停状态

##### Scenario: 返回编辑器
- **WHEN** 用户按下 `Esc`、再次按下 `F` 或点击退出按钮
- **THEN** 系统恢复进入前的工具栏、检查器、缩放模式和时间轴布局，播放位置保持连续

##### Scenario: 会话或视图切换
- **WHEN** 专注预览期间当前会话关闭、被删除或切换到非预览视图
- **THEN** 系统安全退出专注预览且不把该模式持久化到 `edit.json`
