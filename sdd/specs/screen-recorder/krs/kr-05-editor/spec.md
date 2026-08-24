---
id: "kr-05-editor"
kind: kr
parent: "screen-recorder"
status: in_progress
impact_radius:
  - "src/components/"
  - "src/timeline/"
  - "src/render/"
dependencies:
  - "kr-02-motion-playback"
  - "kr-03-mp4-export"
---

# Specification: kr-05-editor（M5 编辑器） (Specification)

## 0. Key Result Statement (KR only)
在预览基础上提供简单时间线编辑器：手动调整/增删相机关键帧、删除片段、webcam 画中画叠加、按键回显层；验收指标：编辑结果同时作用于预览与导出，完成"录制 → 编辑 → 运镜 → 导出"完整 MVP 闭环。
- **Parent Epic**: [screen-recorder](../../spec.md)
- **Target Metric**: 用户可手动新增/移动/删除关键帧并即时预览；删除片段后导出视频时长与内容正确；webcam 画中画与按键回显在导出 mp4 中正确呈现。

## 1. Scope
- **In Scope**:
  - 时间线编辑器 UI：关键帧可视化、拖拽移动、手动新增/删除相机关键帧
  - ~~片段删除：选区裁剪时间线，事件流与视频同步截断/拼接~~（已由 change: timeline-editing 以“非破坏式裁剪区间”交付：原始数据不动，预览/导出按裁剪映射生效）
  - webcam 画中画：录制期第二路 webcam 采集（webcam.webm），合成时叠加（位置/尺寸可调）
  - 按键回显层：基于 keys 事件在对应时刻叠加按键徽章
  - 编辑结果的持久化（会话级 `edit.json`）与预览/导出一致性（已由 change: interactive-timeline-effects 交付）
- **Out of Scope**:
  - 转场、专业混音和音频效果器（基础多轨音频已登记为后续 change: multi-track-audio-editing）
  - 撤销/重做历史（可后续迭代）
  - 运镜规则之外的特效（模糊背景、自定义背景图等后续迭代）
  - 云端工程同步

## 2. Functional Requirements

### ADDED

#### Requirement: 手动关键帧编辑
The system SHALL 在时间线上可视化展示自动生成的相机关键帧，支持拖拽移动、手动新增与删除，编辑后预览即时刷新。

##### Scenario: 拖拽调整关键帧
- **WHEN** 用户将某关键帧沿时间轴拖拽到新位置
- **THEN** 相机在该新时间点到达目标状态，预览即时反映变化

##### Scenario: 新增与删除关键帧
- **WHEN** 用户在任意时间点新增关键帧（指定 x/y/zoom）或删除既有自动关键帧
- **THEN** 关键帧序列更新，spring 插值重算，预览即时刷新

##### Scenario: 关键帧越界保护
- **WHEN** 用户将关键帧拖拽到时长范围外或将 zoom 设为非法值（≤ 0 或超出上限）
- **THEN** 输入被钳制到合法范围并给出提示，不产生坏数据

#### Requirement: 片段删除
The system SHALL 支持在时间线上选择区间并删除，删除后该区间的视频、鼠标轨迹、点击与键盘事件一并移除，后续时间轴前移闭合。

##### Scenario: 删除中间片段
- **WHEN** 用户删除 t=10s～15s 区间
- **THEN** 导出视频总时长减少 5s，删除点前后画面与事件衔接正确，关键帧时间戳同步平移

##### Scenario: 删除区间覆盖关键帧
- **WHEN** 被删区间内包含相机关键帧
- **THEN** 这些关键帧一并移除，删除点处相机状态由相邻关键帧插值接管，无跳变

#### Requirement: webcam 画中画
The system SHALL 支持录制期同步采集 webcam（webcam.webm），合成时作为画中画层叠加（合成顺序最末），位置与尺寸可调。

##### Scenario: 画中画合成
- **WHEN** 会话包含 webcam.webm 且用户开启画中画
- **THEN** 预览与导出画面在设定位置叠加 webcam 画面，与主画面时间轴同步

##### Scenario: 无 webcam 素材
- **WHEN** 会话不含 webcam.webm
- **THEN** 画中画开关置灰并提示"本会话无摄像头素材"，不影响其他功能

#### Requirement: 按键回显
The system SHALL 基于 keys 事件在对应时刻叠加按键徽章层（位于点击波纹之后、画中画之前）。

##### Scenario: 按键徽章显示
- **WHEN** 播放/导出经过 keys 事件时间点
- **THEN** 画面叠加对应按键名徽章，短暂停留后消失

##### Scenario: 组合键与高频输入
- **WHEN** 用户快速连续输入或按组合键（如 Shift+A）
- **THEN** 徽章按事件序列正确呈现或合并显示，不堆积遮挡画面主体
