---
id: "kr-02-cursor-follow-camera"
kind: change
parent: "kr-02-motion-playback"
status: in_progress
impact_radius:
  - "src/timeline/cursorFollow.ts"
  - "src/timeline/derive.ts"
  - "scripts/cursor-follow.smoke.ts"
  - "docs/TECH_DESIGN.md"
dependencies:
  - "kr-01-capture-foundation"
  - "kr-02-motion-playback"
---

# Specification: 放大运镜鼠标安全区跟随 (Specification)

## 1. Scope

- **In Scope**: 在自动点击放大期间使用已有 `mouseTrack` 调整相机 x/y；画面中央 40%（中心横纵各 ±20%）为安全区；鼠标越界后相机以 spring 平滑追随；画布边缘钳制；预览与导出共用确定性结果。
- **Out of Scope**: 全景状态跟随；始终将鼠标锁在正中心；新的 UI 参数；修改 events.json；光标矢量重绘或轨迹样条美化（归属 kr-04）。

## 2. Functional Requirements

### ADDED

#### Requirement: 放大期间安全区跟随
The system SHALL 在相机缩放目标大于 1.05 时读取录制的鼠标轨迹，并把画面中央 40% 作为安全区；鼠标相对视口中心在横向或纵向超过完整视口尺寸的 20% 后，仅移动足以重新容纳鼠标的相机目标位置。

##### Scenario: 安全区内移动
- **WHEN** 点击放大已经生效，鼠标在中央安全区内移动
- **THEN** 相机视角保持稳定，不因细小移动产生晃动

##### Scenario: 鼠标越过安全区
- **WHEN** 放大期间鼠标越过安全区边缘
- **THEN** 相机目标沿对应方向平滑移动，鼠标重新进入安全区，缩放倍率保持不变

##### Scenario: 回归全景
- **WHEN** 相机开始回归并达到 `zoom <= 1.05`
- **THEN** 鼠标轨迹不再改变相机中心，全景保持画布中心

#### Requirement: 跟随稳定性与边界保护
The system SHALL 对高频鼠标轨迹做有界采样与位移降噪，使用现有 spring 过渡相机目标，并继续通过画布边界钳制避免黑边穿帮。

##### Scenario: 鼠标高频抖动
- **WHEN** 放大期间鼠标在安全区边缘附近产生小幅高频移动
- **THEN** 不生成密集往返运镜，相机位置连续且无可见跳变

##### Scenario: 鼠标移动到画布边缘
- **WHEN** 鼠标移动到源画面的最左、最右、最上或最下边缘
- **THEN** 相机平滑追随至允许的最大位置且不越出画布

#### Requirement: 预览与导出一致
The system SHALL 从同一份 `events.json.mouseTrack` 派生确定性相机目标，供实时预览和离线导出共同使用。

##### Scenario: 同一时间点采样
- **WHEN** 对同一会话的同一源时间点分别执行预览 seek 与导出采样
- **THEN** 两者得到一致的 `{x, y, zoom}` 相机状态

##### Scenario: 无鼠标轨迹
- **WHEN** 旧会话或降级录制的 `mouseTrack` 为空
- **THEN** 保持现有仅由点击驱动的自动运镜行为，不报错

### MODIFIED

#### Requirement: 自动关键帧生成
原有“点击前生成缩放目标、停留后回归全景”保持不变；新增在放大区间内根据鼠标安全区越界情况生成稀疏位置目标，且不得改变运镜片段的缩放倍率与回归时机。

##### Scenario: 连续密集点击
- **WHEN** 两次点击被合并为同一放大运镜片段
- **THEN** 新点击仍优先更新焦点，随后继续按该片段内的鼠标轨迹执行安全区跟随
