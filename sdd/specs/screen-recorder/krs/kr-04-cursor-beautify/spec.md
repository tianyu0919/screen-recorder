---
id: "kr-04-cursor-beautify"
kind: kr
parent: "screen-recorder"
status: draft
impact_radius:
  - "electron/capture/"
  - "electron/input/"
  - "src/render/"
dependencies:
  - "kr-01-capture-foundation"
---

# Specification: kr-04-cursor-beautify（M4 光标美化） (Specification)

## 0. Key Result Statement (KR only)
通过原生采集 helper PoC 获取无光标的屏幕画面（macOS ScreenCaptureKit `showsCursor=false` / Windows WGC `IsCursorCaptureEnabled=false`），并在渲染期基于录制轨迹重绘矢量光标（去抖 + catmull-rom 平滑、可放大、可换肤）；验收指标：光标可放大/换肤，轨迹平滑无抖动。
- **Parent Epic**: [screen-recorder](../../spec.md)
- **Target Metric**: 录制画面不含烧录光标；重绘光标位置与真实鼠标轨迹重合（目视无可见偏移）；平滑后轨迹无抖动、无折线感；至少 2 套光标皮肤可切换。

## 1. Scope
- **In Scope**:
  - macOS 原生采集 helper PoC：Swift 小工具，ScreenCaptureKit `showsCursor = false`，子进程或 N-API 把帧/流喂给 Electron
  - Windows 原生采集 helper PoC：Windows.Graphics.Capture `IsCursorCaptureEnabled = false`
  - 采集器抽象落地：kr-01 预留的 `captureCursor: boolean` 在 helper 可用时置 false
  - 轨迹平滑：去抖（最小移动阈值）+ catmull-rom 样条插值
  - 矢量光标重绘：SVG/高分辨率位图按 DPR 缩放渲染，支持换肤与放大倍率
  - 光标渲染层接入既有合成顺序（视频层之上、点击波纹配合）
- **Out of Scope**:
  - macOS 系统声音采集（ScreenCaptureKit 音频属后续迭代，虽为方案 B 的附带动机）
  - 录制期实时光标替换（光标重绘只在渲染/导出期做）
  - Linux 平台无光标采集（本期不支持）
  - 光标形状随系统状态（手型/文本光标）动态切换（后续迭代）

## 2. Functional Requirements

### ADDED

#### Requirement: 原生采集 helper（无光标画面）
The system SHALL 提供 macOS（ScreenCaptureKit）与 Windows（WGC）原生采集 helper，以 `showsCursor=false` / `IsCursorCaptureEnabled=false` 采集屏幕画面并通过子进程/N-API 喂给 Electron；helper 不可用时回退 kr-01 的 desktopCapturer 路径。

##### Scenario: macOS helper 采集
- **WHEN** macOS 上以 `captureCursor: false` 开始录制
- **THEN** 产出的视频帧不含系统光标，帧率/分辨率满足录制要求

##### Scenario: Windows helper 采集
- **WHEN** Windows 上以 `captureCursor: false` 开始录制
- **THEN** 产出的视频帧不含系统光标

##### Scenario: helper 启动失败回退
- **WHEN** 原生 helper 进程启动失败或崩溃
- **THEN** 系统回退到 desktopCapturer 采集（`captureCursor: true`），UI 提示"光标美化不可用，光标已录进画面"，录制不中断

#### Requirement: 轨迹平滑
The system SHALL 对 mouseTrack 原始轨迹先做去抖（小于最小移动阈值的抖动被抑制），再用 catmull-rom 样条插值生成渲染轨迹。

##### Scenario: 抖动抑制
- **WHEN** 原始轨迹存在高频小幅抖动（如手抖、轮询噪声）
- **THEN** 渲染轨迹中该抖动被消除，光标静止时画面光标不动

##### Scenario: 快速移动保真
- **WHEN** 鼠标做一次快速长距离移动
- **THEN** 平滑轨迹仍贴合真实路径，无明显的"抄近路"截弯失真

#### Requirement: 矢量光标重绘与换肤
The system SHALL 在渲染期按平滑轨迹重绘矢量光标（SVG/高分辨率位图，按 DPR 缩放），支持光标放大倍率与皮肤切换，同时作用于预览与导出。

##### Scenario: 光标放大
- **WHEN** 用户将光标倍率调至 1.5x
- **THEN** 预览与导出中光标按倍率放大渲染，边缘清晰（矢量/高分辨率，无模糊锯齿）

##### Scenario: 换肤
- **WHEN** 用户切换光标皮肤
- **THEN** 预览即时更新，导出产物使用所选皮肤

##### Scenario: 光标已烧录的旧会话兼容
- **WHEN** 打开 kr-01 时期（captureCursor=true）录制的旧会话
- **THEN** 系统检测到画面已含光标，默认关闭光标重绘层（避免双光标），并提示原因
