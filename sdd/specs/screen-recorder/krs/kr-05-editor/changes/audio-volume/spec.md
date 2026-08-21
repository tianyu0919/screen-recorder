---
id: "kr-05-audio-volume"
kind: change
parent: "kr-05-editor"
status: in_progress
impact_radius:
  - "src/components/preview/"
  - "src/store/previewStore.ts"
  - "src/store/exportStore.ts"
  - "src/export/"
---

# Change: 编辑器音频音量控制（分轨增益）

## 背景

编辑器检查器目前只有运镜参数与裁剪，音频完全不可控：mic.wav / system.wav 两轨在预览
（`<audio>` 同步播放）与导出（`mixPcm` 固定 1:1 混音）中都按原始电平输出。
本 change 交付分轨音量控制：麦克风轨、系统音频轨各自 0–100% 增益，预览实时生效，
导出混音应用同一增益，预览/导出听感一致。

## 设计决策（yolo 模式下锁定）

- 增益范围 0–100%（步进 5%，默认 100%）；0% 即静音，不单独做 mute 开关。
  >100% 增益在预览侧受 `HTMLMediaElement.volume ≤ 1` 限制，需引入 WebAudio GainNode，
  列为后续增强，本期不做。
- 音量参数与运镜参数一致：**不持久化**，会话重开恢复默认（编辑状态持久化 edit.json
  已由 timeline-editing 定档为后续计划，音量参数届时一并纳入）。
- 无对应音轨的会话：该轨滑杆禁用；两轨都无时整个「音频」区不渲染。

## Scope

- **In Scope**: 检查器「音频」区（分轨滑杆）；预览音量实时生效；导出混音增益；worker 消息协议扩展。
- **Out of Scope**: 倍速播放、画面区域裁切、淡入淡出/转场、音量关键帧自动化、>100% 增益、设置持久化。

## Functional Requirements

### ADDED

#### Requirement: 分轨音量调节（检查器）
The system SHALL 在检查器提供「音频」区，含麦克风轨、系统音频轨两条增益滑杆
（0–100%，步进 5%，默认 100%），会话缺少某轨时该滑杆禁用。

##### Scenario: 调节麦克风音量
- **WHEN** 会话含 mic.wav 且用户拖动「麦克风」滑杆到 50%
- **THEN** 预览播放中麦克风声道音量立即减半，系统音频轨不受影响

##### Scenario: 无音轨会话
- **WHEN** 会话既无 mic.wav 也无 system.wav
- **THEN** 检查器不显示「音频」区

##### Scenario: 单轨会话
- **WHEN** 会话仅有 system.wav（无 mic.wav）
- **THEN** 「麦克风」滑杆禁用，「系统音频」滑杆可调

#### Requirement: 导出应用音量增益
The system SHALL 在导出混音时对 mic/system 两轨分别应用检查器当前增益
（含单轨直通路径），int16 clamp 防削波，输出与预览听感一致。

##### Scenario: 增益作用于导出产物
- **WHEN** 用户将系统音频调为 30% 后导出 mp4
- **THEN** 产物中系统音频电平约为原始的 30%，麦克风轨保持原电平

##### Scenario: 默认增益无回归
- **WHEN** 用户未调整音量（两轨均 100%）直接导出
- **THEN** 混音结果与既有行为逐样本一致

### 后续候选（不在本期）

倍速播放、画面区域裁切、淡入淡出、音量关键帧自动化、>100% 增益（WebAudio GainNode）、
编辑状态持久化（edit.json 纳入音量参数）。
