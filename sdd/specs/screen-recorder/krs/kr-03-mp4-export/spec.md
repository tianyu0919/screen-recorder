---
id: "kr-03-mp4-export"
kind: kr
parent: "screen-recorder"
status: draft
impact_radius:
  - "src/export/"
  - "src/render/"
dependencies:
  - "kr-01-capture-foundation"
  - "kr-02-motion-playback"
---

# Specification: kr-03-mp4-export（M3 mp4 导出） (Specification)

## 0. Key Result Statement (KR only)
在 Worker 线程中实现离线确定性逐帧渲染导出管线（时间轴驱动而非实时），基于 WebCodecs VideoDecoder/VideoEncoder 与 mp4-muxer 输出 1080p60 H.264 mp4；验收指标：导出结果与预览一致，输出帧率恒定 60fps，不受机器性能影响。
- **Parent Epic**: [screen-recorder](../../spec.md)
- **Target Metric**: 1080p60 mp4 导出成功；导出帧内容与预览同时间点帧一致；导出耗时可超过实时但不丢帧、不变帧率；H.264 不可用时 fallback 可用。

## 1. Scope
- **In Scope**:
  - Worker 线程导出管线：时间轴驱动器（t = 0, 1/60, 2/60 ...）→ 复用 kr-02 WebGL 合成器渲染到 OffscreenCanvas → VideoEncoder（H.264）逐帧喂 VideoFrame → mp4-muxer 封装 → Blob 写盘
  - WebCodecs `VideoDecoder` 精确逐帧解码源 webm（demux 用 mediabunny）
  - 音频混入：mic.wav 经 AudioEncoder 或 ffmpeg.wasm 混入（需要 AAC 时引入 ffmpeg.wasm / mediabunny）
  - H.264 能力探测（`VideoEncoder.isConfigSupported`）与 fallback（VP9+webm，或提示 ffmpeg.wasm 转码）
  - 导出进度上报与取消
- **Out of Scope**:
  - 录制期编码改动（kr-01 已定 MediaRecorder 高码率 webm）
  - 光标矢量重绘（kr-04）
  - 编辑器功能（kr-05）
  - 自定义导出分辨率/码率的高级设置面板（MVP 固定 1080p60，参数可后续开放）

## 2. Functional Requirements

### ADDED

#### Requirement: 时间轴驱动的确定性逐帧渲染
The system SHALL 在 Worker 线程中以固定步长（1/60s）驱动时间轴，对每一帧时间点求值相机状态并渲染到 OffscreenCanvas，渲染速度不影响输出帧时间戳。

##### Scenario: 确定性输出
- **WHEN** 在高性能与低性能机器上分别导出同一会话
- **THEN** 两次导出的 mp4 帧数相同（时长×60）、帧率恒定 60fps，画面内容逐帧一致

##### Scenario: 渲染慢于实时
- **WHEN** 单帧渲染耗时超过 1/60s
- **THEN** 导出继续按时间轴推进（总耗时变长），输出帧时间戳严格均匀，无丢帧

#### Requirement: 源视频逐帧解码
The system SHALL 用 mediabunny demux 源 webm、WebCodecs VideoDecoder 按导出时间轴精确取帧，与渲染帧一一对应。

##### Scenario: 帧对齐
- **WHEN** 导出时间轴请求任意时间点 t 的源画面
- **THEN** 解码器返回不晚于 t 的最近帧，画面与预览 seek 到 t 时的源帧一致

##### Scenario: 源文件损坏或编码不支持
- **WHEN** VideoDecoder 配置不被支持或 demux 失败
- **THEN** 导出中止并提示"源视频无法解码"，不产出残缺的 mp4 文件

#### Requirement: H.264 编码与 mp4 封装
The system SHALL 用 WebCodecs VideoEncoder 将逐帧 VideoFrame 编码为 H.264，经 mp4-muxer 封装为 mp4 并写盘；音频由 mic.wav 混入。

##### Scenario: 正常导出
- **WHEN** 用户对 1 分钟会话执行导出
- **THEN** 产出 1080p60 H.264 mp4，可被系统播放器/主流播放器正常打开，声画同步（含 mic.wav 时）

##### Scenario: H.264 不可用 fallback
- **WHEN** `VideoEncoder.isConfigSupported({ codec: 'avc1.*' })` 探测失败（当前 Electron 版本/平台不支持 openh264/硬编）
- **THEN** 系统按 fallback 导出 VP9+webm（或引导用户启用 ffmpeg.wasm 转码），明确告知产物格式变化，不产出损坏文件

#### Requirement: 导出进度与取消
The system SHALL 向 Renderer 上报导出进度百分比，并支持用户取消导出。

##### Scenario: 进度上报
- **WHEN** 导出进行中
- **THEN** UI 显示与已渲染帧数成比例的进度，导出完成后给出文件保存路径

##### Scenario: 中途取消
- **WHEN** 用户在导出中途点击取消
- **THEN** Worker 终止编码与封装，清理临时资源，不留下半成品 mp4
