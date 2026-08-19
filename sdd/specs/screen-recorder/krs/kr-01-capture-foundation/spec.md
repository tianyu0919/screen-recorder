---
id: "kr-01-capture-foundation"
kind: kr
parent: "screen-recorder"
status: completed
impact_radius:
  - "electron/capture/"
  - "electron/input/"
  - "electron/store/"
  - "src/components/"
dependencies:
  - "none"
---

# Specification: kr-01-capture-foundation（M1 采集底座） (Specification)

## 0. Key Result Statement (KR only)
搭起 electron-vite + React + TypeScript 脚手架，实现选屏录制（desktopCapturer + MediaRecorder 高码率 webm）、Main 进程鼠标轨迹高频轮询、uiohook-nap 点击/键盘采集与录制会话落盘；验收指标：录 1 分钟，事件与视频时间轴对齐误差 < 50ms。
- **Parent Epic**: [screen-recorder](../../spec.md)
- **Target Metric**: 事件时间戳与视频时间轴对齐误差 < 50ms；录制会话目录（screen.webm + mic.wav + events.json）结构符合 design.md §2 契约。

## 1. Scope
- **In Scope**:
  - electron-vite + React + TypeScript + Tailwind/shadcn/ui + zustand 项目脚手架
  - 屏幕/窗口源枚举与选择（`desktopCapturer.getSources({ types: ['screen', 'window'] })`，或 `session.setDisplayMediaRequestHandler` + `getDisplayMedia`）
  - MediaRecorder 高码率（12–20 Mbps，vp9/webm）录制原始画面
  - Main 进程 `screen.getCursorScreenPoint()` 以 60–120Hz 轮询记录 `{ t, x, y }`
  - uiohook-nap 全局钩子记录 mousedown/up、keypress
  - 麦克风采集（`getUserMedia({ audio: true })`，单独一条轨，落盘 mic.wav）
  - 录制会话落盘：`recordings/<session-id>/`（screen.webm + mic.wav 可选 + events.json）
  - 采集器抽象预留 `captureCursor: boolean`（MVP 恒为 true，为 kr-04 原生 helper 预留）
  - macOS 权限引导（屏幕录制 + 辅助功能）
- **Out of Scope**:
  - 系统声音采集（macOS Electron 拿不到；Windows loopback 后续迭代）
  - 无光标采集（光标烧录为 MVP 既定取舍，见 kr-04）
  - webcam 采集（kr-05）
  - `MediaStreamTrackProcessor` + VideoFrame 原始帧采集（v2 进阶）
  - 任何运镜渲染与导出逻辑（kr-02/kr-03）
  - App 级采集（一个 App 的所有窗口，含录制期间新弹出的窗口）——窗口源采集的固有语义是"录制选定那一刻的窗口"，App 新弹窗录不上属预期行为；产品定为**整屏主模式**，窗口模式仅限单窗口演示场景；App 级采集留给 kr-04 原生 helper（ScreenCaptureKit 支持 SCWindow/SCApplication 粒度），记 backlog

## 2. Functional Requirements

### ADDED

#### Requirement: 屏幕源枚举与选择
The system SHALL 枚举可用的 screen/window 采集源并以缩略图列表呈现给用户选择，选择后通过 ScreenCaptureKit 路径（Main `session.setDisplayMediaRequestHandler` 按选中 sourceId approve + Renderer `getDisplayMedia`）建立采集流。

##### Scenario: 正常选源录制
- **WHEN** 用户打开源选择面板并点击某个屏幕源
- **THEN** 系统建立该源的 MediaStream，预览确认后允许开始录制

##### Scenario: 录制期间画面持续更新（防回归）
- **WHEN** 录制进行中且被录画面内容发生变化（含窗口源被移动/缩放/遮挡）
- **THEN** 产出的视频帧持续反映最新画面，不停滞在起始帧

##### Scenario: macOS 屏幕录制权限被拒
- **WHEN** 系统未获得屏幕录制权限，`getDisplayMedia` 返回错误或无画面
- **THEN** 系统弹出权限引导页（含系统设置跳转指引），禁止进入录制，不显示原始错误堆栈

##### Scenario: 无可用采集源
- **WHEN** `desktopCapturer.getSources` 返回空列表
- **THEN** 源选择面板显示"无可用源"空态与重试按钮，而非崩溃

#### Requirement: 高码率画面录制
The system SHALL 使用 MediaRecorder 以 12–20 Mbps 码率（vp9/webm）编码原始画面，录制期不做任何渲染/运镜处理以保证低 CPU 占用。

##### Scenario: 正常录制与停止
- **WHEN** 用户点击开始录制、随后点击停止
- **THEN** 系统将完整画面流分片写入 `recordings/<session-id>/screen.webm`，文件可被标准播放器打开

##### Scenario: 录制中源窗口被关闭
- **WHEN** 用户录制的是窗口源且该窗口被关闭，流触发 `ended`/inactive
- **THEN** 系统安全停止录制并保留已落盘片段，提示"采集源已断开"

##### Scenario: 磁盘空间不足
- **WHEN** 录制中磁盘写入失败（ENOSPC）
- **THEN** 系统立即停止采集、保留已落盘数据并提示用户磁盘不足，不静默丢数据

#### Requirement: 鼠标轨迹高频采集
The system SHALL 在 Main 进程以 60–120Hz 频率调用 `screen.getCursorScreenPoint()` 轮询光标位置，按相对录制开始的时间戳记录为 `[t, x, y]` 三元组。

##### Scenario: 正常轨迹记录
- **WHEN** 录制进行 1 分钟且鼠标持续移动
- **THEN** `events.json.mouseTrack` 包含约 3600–7200 条采样，时间戳单调递增且与录制开始时间对齐

##### Scenario: 鼠标跨多显示器移动（不同 scaleFactor）
- **WHEN** 录制主屏期间鼠标移动到另一台 scaleFactor 不同的显示器
- **THEN** 轨迹记录原始屏幕坐标，且 `events.json.display` 已记录录制屏的 `id`/`bounds`/`scaleFactor`，渲染期可据此换算（换算本身属于 kr-02 范围）

##### Scenario: 录制中拔插显示器
- **WHEN** 录制期间显示器拓扑变化（拔掉副屏）
- **THEN** 轮询不崩溃；坐标按最新显示器拓扑继续记录，录制不中断

#### Requirement: 点击与键盘事件采集
The system SHALL 使用 uiohook-nap 注册全局钩子，录制期间记录 mousedown/up（含按键号与坐标）与 keypress（归一化按键名），时间戳与录制开始对齐。

##### Scenario: 正常事件记录
- **WHEN** 录制期间用户点击鼠标左键并按 Enter
- **THEN** `events.json.clicks` 出现 `{ t, x, y, button: 1 }`，`events.json.keys` 出现 `{ t, key: "Enter" }`

##### Scenario: macOS 辅助功能权限被拒（钩子启动失败）
- **WHEN** uiohook-nap 钩子因辅助功能权限缺失启动失败
- **THEN** 系统降级为仅录制画面 + 鼠标轨迹，UI 明确提示"点击/键盘事件未采集，自动运镜不可用"，录制可继续

#### Requirement: 录制会话落盘
The system SHALL 在停止录制后将会话写入 `recordings/<session-id>/`，包含 screen.webm、mic.wav（如开启麦克风）与符合 design.md §2 类型定义的 events.json。

##### Scenario: 会话完整性校验
- **WHEN** 录制正常结束
- **THEN** events.json 通过 schema 校验（version=1，startTime、display、video、mouseTrack、clicks、keys 字段齐全），且 video.file 指向实际存在的 screen.webm

##### Scenario: 时间轴对齐验收
- **WHEN** 录 1 分钟并在一已知画面变化时刻（如点击触发明显 UI 反馈）产生点击事件
- **THEN** 点击事件时间戳与视频中对应画面变化帧的时间差 < 50ms
