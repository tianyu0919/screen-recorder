---
id: "kr-01-microphone-permission-flow"
kind: change
parent: "kr-01-capture-foundation"
status: in_progress
impact_radius:
  - "electron/permissions.ts"
  - "electron/ipc.ts"
  - "electron/preload/index.ts"
  - "shared/ipc.ts"
  - "src/store/appStore.ts"
  - "src/components/PermissionGuide.tsx"
  - "src/components/RecordingPanel.tsx"
  - "src/recorder/screenRecorder.ts"
dependencies:
  - "kr-01-capture-foundation"
  - "ui-modern-light-motion-refresh"
---

# Specification: 麦克风权限与可选录制流程

## 1. Scope

- **In Scope**: macOS 麦克风权限的独立展示与申请入口；麦克风开关和真实权限同步；首次申请、拒绝后跳转设置、重新检查；无麦克风录制降级及明确反馈。
- **Out of Scope**: Windows 麦克风设备管理；输入设备选择；录制中切换麦克风；音量控制、降噪、回声消除；修改音频文件格式。

## 2. Functional Requirements

### ADDED

#### Requirement: 独立可见的麦克风权限状态
系统 SHALL 独立展示麦克风授权状态；即使屏幕录制和辅助功能均已授权，只要麦克风未授权，首页仍提供麦克风说明与授权入口，并明确标注麦克风为可选能力。

##### Scenario: 仅麦克风未授权
- **WHEN** 屏幕录制和辅助功能已授权，但麦克风状态不是 `granted`
- **THEN** 首页仍显示麦克风未授权状态和对应操作，不把前两项的成功状态误认为全部权限完成

##### Scenario: 重新检查
- **WHEN** 用户从系统设置返回并点击“重新检查”
- **THEN** 系统分别刷新三项权限；麦克风已授权时显示绿色成功并启用麦克风录制能力

#### Requirement: 权限驱动的麦克风开关
系统 SHALL 让首页麦克风开关反映“本次是否录制麦克风”和系统授权的组合状态；未授权时默认关闭，不得显示为可正常工作的开启状态。

##### Scenario: 首次申请
- **WHEN** 麦克风权限为 `unknown`，用户尝试打开麦克风开关
- **THEN** 系统立即触发 macOS 麦克风授权请求，并在结果返回后刷新权限状态；仅授权成功时打开开关

##### Scenario: 已明确拒绝
- **WHEN** 麦克风权限为 `denied`，用户点击麦克风开关或授权操作
- **THEN** 系统说明需要在系统设置中授权，并打开“隐私与安全性 → 麦克风”面板，不把开关置为开启

##### Scenario: 权限被撤销
- **WHEN** 应用刷新到麦克风权限已从 `granted` 变为非授权状态
- **THEN** 麦克风开关自动关闭，界面立即显示未授权状态

#### Requirement: 无麦克风录制不被阻断
系统 SHALL 允许用户在麦克风关闭或未授权时正常录制画面和其他可用数据，不生成 `mic.wav`。

##### Scenario: 主动关闭麦克风
- **WHEN** 用户保持麦克风开关关闭并开始录制
- **THEN** 录制直接开始，不弹出麦克风授权请求，最终会话不包含麦克风音轨

##### Scenario: 开始前权限变化
- **WHEN** 用户已打开麦克风但权限在开始录制前被撤销或采集失败
- **THEN** 系统使用中文提示麦克风不可用，并安全降级为无麦克风录制，不延后到停止录制或写入文件时才申请权限

### MODIFIED

#### Requirement: 麦克风授权时机
麦克风授权 SHALL 在用户主动打开麦克风能力时完成；开始录制和写入 `mic.wav` 不再作为首次申请权限的入口。

##### Scenario: 点击开始录制
- **WHEN** 麦克风开关处于关闭状态或权限未授权
- **THEN** 点击开始录制不会弹出麦克风系统授权框，录制按无麦克风模式启动
