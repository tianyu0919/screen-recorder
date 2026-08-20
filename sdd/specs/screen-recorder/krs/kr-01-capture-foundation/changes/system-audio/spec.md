---
id: "kr-01-system-audio"
kind: change
parent: "kr-01-capture-foundation"
status: completed
impact_radius:
  - "src/recorder/"
  - "electron/store/"
  - "shared/"
  - "src/components/preview/"
  - "src/export/"
---

# Change: 系统音频采集（system audio loopback）

## 背景

kr-01 交付时 macOS 上 getDisplayMedia 不支持系统音频，`audio: false` 硬编码。
实测 Electron 39 + macOS 26.5：`setDisplayMediaRequestHandler` 回调带 `audio: 'loopback'`
可拿到 "System audio" 轨（48kHz），可行。

## Functional Requirements

### ADDED

#### Requirement: 系统音频采集
The system SHALL 在屏幕采集时同时请求系统音频回采轨（loopback），支持的平台（macOS 13+ SCK / Windows 回环）自动生效，不支持的平台静默降级为无系统音轨，不阻断录制。

##### Scenario: 整屏录制带系统声音
- **WHEN** 用户录制整屏且系统正在播放声音
- **THEN** 会话目录落盘 system.wav（16bit PCM，与 mic.wav 同规格），events.json 格式不变

##### Scenario: 平台不支持 / 无音频轨
- **WHEN** 采集流不含音频轨（平台不支持或窗口源无声音）
- **THEN** 录制正常进行，不落盘 system.wav，不报错

#### Requirement: 预览与导出包含系统声音
The system SHALL 在预览播放时同步播放 system.wav 与 mic.wav 两条音频轨，导出时将两轨混合为单条 AAC 音轨。

##### Scenario: 预览声画同步
- **WHEN** 预览播放在含系统声音的会话
- **THEN** 系统声音与画面同步，暂停/seek 同步生效

##### Scenario: 导出混音
- **WHEN** 导出含 system.wav（和/或 mic.wav）的会话
- **THEN** 产出 mp4 的音轨为两轨混合结果，声画同步；只有单轨时等同现状

## 设计约束

- 录制与渲染分离原则：系统音频**单独落盘 system.wav**，不混入 screen.webm（screen.webm 保持纯视频轨）；混音发生在预览/导出期
- MediaRecorder 画面轨只用 video track 建流，避免系统音频被 mux 进 screen.webm
- 系统音频轨关闭语音处理（echoCancellation/noiseSuppression/autoGainControl 全关）

## 平台路径（2026-08-20 实测修订）

getDisplayMedia loopback 在 `useSystemPicker: false`（自研选源 UI）下 macOS 上轨道出生即 ended
（[electron#52738](https://github.com/electron/electron/issues/52738)，open，无应用侧 workaround）：

- **macOS 主路径：原生 helper**。`native/sck-audio/`（Swift CLI，ScreenCaptureKit SCStream
  capturesAudio）录制开始时被 spawn，直接把系统音频写成会话目录的 system.wav，停止时
  SIGTERM 收尾 WAV header。TCC 权限归属宿主 app；打包随 app 签名/公证
- **Windows 路径：getDisplayMedia loopback**（Chromium 原生支持，已保留）
  ⚠️ 2026-08-21 起被取代：该路径实测有杂音且 VB 虚拟设备用户采到全零，
  见 [../win32-native-audio/spec.md](../win32-native-audio/spec.md)（Windows 改走原生 WASAPI helper）
- macOS 上 getDisplayMedia 返回的死轨必须跳过（readyState !== 'live' 不建 MediaRecorder）

