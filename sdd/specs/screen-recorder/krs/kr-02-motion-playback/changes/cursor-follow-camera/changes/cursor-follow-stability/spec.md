---
id: "kr-02-cursor-follow-stability"
kind: change
parent: "kr-02-cursor-follow-camera"
status: draft
impact_radius:
  - "src/timeline/cursorFollow.ts"
  - "src/timeline/derive.ts"
  - "scripts/cursor-follow.smoke.ts"
  - "docs/TECH_DESIGN.md"
dependencies:
  - "kr-02-cursor-follow-camera"
  - "kr-05-interactive-timeline-effects"
---

# Specification: 鼠标跟随稳定性与提前响应

## 1. Scope

- **In Scope**: 放大运镜期间的位移触发阈值、进入/退出阈值滞回、轨迹前瞻、平滑相机目标、到位后的重新锚定、画布边界钳制，以及预览/导出确定性一致。
- **Out of Scope**: 全景状态跟随；修改 `events.json`；新增用户可调参数；光标样式和轨迹重绘；改变运镜倍率、片段起止时间或点击焦点规则。

## 2. Functional Requirements

### MODIFIED

#### Requirement: 有意图的跟随触发
系统 SHALL 仅在鼠标相对最近稳定锚点产生明显位移时启动跟随；细小移动和安全区边缘噪声不得持续推动相机。

##### Scenario: 稳定区内小幅移动
- **WHEN** 放大画面已稳定，鼠标位移不超过当前视口短边的 3%
- **THEN** 相机目标保持不变，不生成新的跟随关键帧

##### Scenario: 明显跨区移动
- **WHEN** 鼠标产生超过当前视口短边 15% 的持续位移，或预测位置即将越过舒适区
- **THEN** 系统启动一次跟随，把鼠标重新纳入舒适构图范围

#### Requirement: 前瞻式柔和跟随
系统 SHALL 利用录制轨迹中短时间未来样本识别移动方向，在鼠标完成大幅移动前开始推动相机，并使用有界平滑避免突然跳变。

##### Scenario: 快速长距离移动
- **WHEN** 鼠标在 100–200ms 内持续向同一方向移动较长距离
- **THEN** 相机在明显视觉滞后产生前开始沿该方向移动，且位置连续、无瞬移或过冲抖动

##### Scenario: 方向快速反转
- **WHEN** 鼠标移动途中快速反向
- **THEN** 前瞻目标被重新评估，相机平滑减速或改向，不生成密集往返关键帧

#### Requirement: 滞回与到位后重新锚定
系统 SHALL 使用不同的触发阈值与重新激活阈值；一次跟随到位后建立新的稳定锚点，只有新的明显位移才能再次触发。

##### Scenario: 到位后的轻微移动
- **WHEN** 相机完成一次跟随后，鼠标继续在新位置附近轻微移动
- **THEN** 相机保持稳定，不继续贴着鼠标逐像素移动

##### Scenario: 再次大幅移动
- **WHEN** 鼠标从新锚点再次跨越触发阈值
- **THEN** 系统启动下一次独立、柔和的跟随

#### Requirement: 确定性和边界安全
系统 SHALL 从同一份录制轨迹派生相机结果，并在所有目标上继续执行画布边界钳制。

##### Scenario: 预览与导出同点采样
- **WHEN** 预览和导出在相同源时间求值相机
- **THEN** 两者得到一致的 `{x, y, zoom}`，且画面不露出源画布外区域

##### Scenario: 轨迹稀疏或缺失
- **WHEN** 轨迹采样间隔过大或 `mouseTrack` 为空
- **THEN** 系统禁用不可靠前瞻并安全降级到既有点击运镜，不报错
