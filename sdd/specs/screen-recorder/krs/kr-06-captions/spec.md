---
id: "kr-06-captions"
kind: kr
parent: "screen-recorder"
status: in_progress
impact_radius:
  - "native/whisper-caption/"
  - "electron/transcription/"
  - "electron/store/"
  - "electron/preload/"
  - "shared/"
  - "src/recorder/"
  - "src/components/preview/"
  - "src/render/"
  - "src/export/"
dependencies:
  - "kr-01-capture-foundation"
  - "kr-02-motion-playback"
  - "kr-03-mp4-export"
  - "kr-05-editor"
---

# Specification: 本地实时字幕与字幕编辑

> **范围变更（2026-08-24）**：第一期不再实现录制中实时字幕，实施以
> [录制后离线字幕生成与编辑](./changes/post-recording-captions/spec.md) 为准；本文件保留原始方案和后续实时能力背景。

## 0. Key Result Statement

Lenza SHALL 在 Windows 和 macOS 上以本地模型完成“录制中临时字幕 → 停录后最终字幕 → 编辑样式/位置 → MP4/SRT 导出”闭环，且字幕失败不得阻断录屏。

- **Parent Epic**: [screen-recorder](../../spec.md)
- **Target Metric**: 推荐硬件临时字幕延迟不超过 2.5 秒；预览与导出样式/位置一致；双平台端到端通过。

## 1. Scope

- **In Scope**: 麦克风单轨识别；本地 whisper.cpp；按需模型下载；auto/zh/en；临时字幕悬浮窗；停录后双遍校正；`captions.json`；字幕轨编辑；全局样式；全局位置与单段位置覆盖；整句淡入淡出；烧录 MP4；SRT；失败重试。
- **Out of Scope**: 系统音频和自定义音轨转写；云端转写；逐字高亮；卡拉 OK；说话人分离；翻译；任意字体文件导入；单段独立样式；字幕动画模板；字幕持久化之外的完整 edit.json。

## 2. Functional Requirements

### ADDED

#### Requirement: 本地模型管理
The system SHALL 在首次开启字幕时按需下载用户选择的本地多语言模型，提供轻量与高精度档位，并校验完整性后才允许加载。

##### Scenario: 首次启用
- **WHEN** 用户开启字幕且本地没有选定模型
- **THEN** 显示下载大小、进度、取消与重试，下载完成后继续录制准备流程

##### Scenario: 下载失败
- **WHEN** 下载中断或摘要校验失败
- **THEN** 不启用字幕并显示可重试错误，录屏功能仍可独立使用

#### Requirement: 麦克风实时临时字幕
The system SHALL 仅从麦克风流生成临时字幕，支持自动检测、中文和英文，并记住上次选择。

##### Scenario: 正常录制
- **WHEN** 字幕已开启且用户开始说话
- **THEN** 不被捕获的悬浮字幕条显示临时结果，目标延迟不超过 2.5 秒

##### Scenario: 转写负载过高
- **WHEN** 临时 PCM 队列超过上限
- **THEN** 丢弃临时识别数据而不是阻塞或降低录屏稳定性

##### Scenario: 麦克风不可用
- **WHEN** 麦克风权限被拒绝或设备不可用
- **THEN** 字幕关闭并提示原因，用户仍可继续无麦克风录屏

#### Requirement: 停录后最终字幕
The system SHALL 在 `mic.wav` 完整落盘后执行全量转写，以最终结果替换临时结果并保存 `captions.json`。

##### Scenario: 后台生成
- **WHEN** 用户停止录制
- **THEN** 会话立即可打开，字幕显示生成中；完成后自动出现字幕轨

##### Scenario: 最终转写失败
- **WHEN** helper 崩溃、模型不可用或音频损坏
- **THEN** 保留视频会话并提供“重新生成字幕”，不得破坏其他编辑功能

#### Requirement: 字幕时间轴编辑
The system SHALL 提供字幕轨，并允许修改文字、拖动起止时间、分割、合并和删除，所有时间保持在真实视频范围内。

##### Scenario: 修改字幕
- **WHEN** 用户选中字幕段并修改文字或时间
- **THEN** 时间轴、预览、MP4 和 SRT 使用同一更新结果，原始麦克风音频不变

##### Scenario: 非破坏式视频裁剪
- **WHEN** 视频存在裁剪区间
- **THEN** 源字幕文档保持不变，预览跳过裁剪内容，SRT 映射为裁剪后的输出时间

#### Requirement: 字幕样式与位置
The system SHALL 支持字体预设、字号、文字颜色、描边、背景颜色与透明度、圆角、对齐、最大宽度和淡入淡出，并允许在画布直接拖动字幕位置。

##### Scenario: 全局样式
- **WHEN** 用户修改任一字幕全局样式或默认位置
- **THEN** 所有未覆盖位置的字幕立即更新，预览与导出视觉一致

##### Scenario: 单段位置覆盖
- **WHEN** 用户选择某条字幕并拖动位置且启用单段调整
- **THEN** 仅该字幕保存归一化位置覆盖，其余字幕继续使用全局位置

##### Scenario: 安全边界
- **WHEN** 用户把字幕拖到画布边缘或设置过大字号/宽度
- **THEN** 字幕整体钳制在输出安全区内，最多按最大宽度自动换行

#### Requirement: 字幕导出
The system SHALL 支持把字幕烧录进视频以及单独导出 SRT，用户可分别启用或关闭。

##### Scenario: 烧录 MP4
- **WHEN** 用户启用字幕并导出 MP4
- **THEN** 每帧通过统一合成器渲染当前字幕，位置、样式、淡入淡出与预览一致

##### Scenario: 仅导出 SRT
- **WHEN** 用户关闭烧录并选择导出 SRT
- **THEN** 视频不含字幕图层，同时输出采用裁剪后时间轴的合法 SRT 文件

#### Requirement: 会话兼容与隐私
The system SHALL 允许没有 `captions.json` 的历史会话正常加载，且默认转写过程不上传麦克风数据。

##### Scenario: 历史会话
- **WHEN** 用户打开旧会话或未开启字幕的会话
- **THEN** 编辑器不显示字幕轨内容，其他功能行为不变，并可手动从已有 `mic.wav` 生成字幕
