---
id: "kr-01-window-capture-fixed-canvas"
kind: feature
parent: "kr-01-capture-foundation"
status: in_progress
impact_radius:
  - "shared/types.ts"
  - "electron/capture/windowGeometry/"
  - "electron/ipc.ts"
  - "electron/store/"
  - "electron/preload/index.ts"
  - "src/recorder/"
  - "src/timeline/"
  - "native/window-geometry/"
  - "native/build.mjs"
  - "electron-builder.yml"
  - ".github/workflows/release.yml"
dependencies:
  - "kr-01-capture-foundation"
  - "kr-02-motion-playback"
  - "kr-03-mp4-export"
---

# Specification: 窗口录制固定画布与动态几何 (Specification)

## 1. Scope

- **In Scope**: macOS/Windows 窗口来源固定物理画布；窗口 bounds 动态采样；移动、缩放、最大化及跨屏移动；点击波纹、自动运镜和鼠标跟随统一坐标映射；events.json V2 与 V1 兼容；预览/导出一致；helper 构建与分发。
- **Out of Scope**: 录制中切换到另一个窗口或显示器来源；隐藏窗口被其他窗口遮挡的系统差异；动态改变最终视频分辨率；窗口内容语义识别；修改整屏录制行为。

## 2. Functional Requirements

### ADDED

#### Requirement: 固定窗口录制画布
系统 SHALL 在窗口录制开始时，以窗口所在显示器的物理分辨率冻结恒定视频画布，并将后续窗口帧等比居中适配到该画布。

##### Scenario: 2K 显示器上的小窗口
- **WHEN** 用户在 2560×1440 显示器上选择小窗口开始录制
- **THEN** screen.webm 从首帧到末帧保持 2560×1440，窗口内容不拉伸、不裁切

##### Scenario: 录制中最大化或还原
- **WHEN** 被录窗口在录制中缩放、最大化或还原
- **THEN** 视频画布分辨率不变，窗口内容按新宽高比重新等比适配，预览与导出不出现异常比例或分辨率跳变

##### Scenario: macOS 圆角窗口叠加背景
- **WHEN** 用户录制带系统圆角的 macOS 窗口，并在编辑器启用任意背景色
- **THEN** 窗口四角透明区域透出所选背景色，预览与导出均不出现黑色角边

##### Scenario: 跨显示器移动
- **WHEN** 被录窗口移动到另一台不同 DPI 或分辨率的显示器
- **THEN** 固定画布仍使用开始显示器的物理尺寸，来源内容与坐标按新窗口几何正确映射

#### Requirement: 动态窗口几何时间线
系统 SHALL 在 macOS 与 Windows 录制期间采样被录窗口的屏幕 bounds，并使用相对录制开始时间写入会话数据。

##### Scenario: 移动和缩放窗口
- **WHEN** 用户移动或缩放被录窗口
- **THEN** geometry 时间线保留变化前后样本，静止期间重复样本被去除

##### Scenario: 几何暂时不可用
- **WHEN** 原生 helper 短时无法返回有效 bounds
- **THEN** 系统沿用最近有效样本且不写入非法尺寸；helper 整体不可用时安全降级并继续录制画面

#### Requirement: 统一交互坐标映射
系统 SHALL 让点击波纹、自动运镜和鼠标安全区跟随共用同一按时间求值的窗口坐标转换函数。

##### Scenario: 窗口内点击
- **WHEN** 用户在窗口移动、缩放或最大化前后点击窗口内容
- **THEN** 波纹绘制在实际点击区域，自动运镜与鼠标跟随使用相同目标坐标

##### Scenario: 窗口外点击
- **WHEN** 全局输入钩子记录到当时窗口 bounds 之外的点击
- **THEN** 该点击不生成窗口内容波纹或自动运镜目标

#### Requirement: 会话兼容与确定性渲染
系统 SHALL 以 events.json V2 保存固定画布与窗口几何，同时继续读取 V1 会话，并保证预览与导出使用相同归一化数据。

##### Scenario: 打开旧会话
- **WHEN** 用户打开不含 source/windowGeometry 的 V1 会话
- **THEN** 系统按既有显示器换算加载，不修改原文件且不阻断预览或导出

##### Scenario: V2 预览与导出
- **WHEN** 用户预览并导出包含窗口几何变化的 V2 会话
- **THEN** 同一时间点的画面 placement、波纹和运镜坐标一致，MP4 分辨率恒定

### MODIFIED

#### Requirement: 录制与渲染分离
录制期仍 SHALL 不生成运镜、波纹或编辑效果；仅允许在 Worker 中执行固定画布归一化，以维持编码分辨率契约。所有可编辑效果继续在预览和导出期由事件数据派生。
