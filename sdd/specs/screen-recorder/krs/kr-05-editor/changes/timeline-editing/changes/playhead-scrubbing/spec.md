---
id: "kr-05-playhead-scrubbing"
kind: change
parent: "kr-05-timeline-editing"
status: in_progress
impact_radius:
  - "src/components/preview/PlayerTimeline.tsx"
  - "src/components/preview/TimelinePlayhead.tsx"
  - "src/components/preview/usePlayback.ts"
  - "src/timeline/cuts.ts"
dependencies:
  - "kr-05-timeline-editing"
---

# Specification: 播放线拖动与裁剪区定位规则

## 1. Scope

- **In Scope**: 编辑时间轴整条播放线拖动；播放状态保持；单击与拖动在裁剪区内的不同定位规则；精确定位到有效首帧。
- **Out of Scope**: 修改裁剪数据；改变导出时间映射；新增时间码输入框；专注预览进度条交互改版。

## 2. Functional Requirements

### ADDED

#### Requirement: 整条播放线可拖动
系统 SHALL 将时间轴中的整条播放线作为可抓取区域，并提供足够宽的透明命中区；拖动过程中实时更新播放位置。

##### Scenario: 播放中拖动
- **WHEN** 用户在播放过程中按住播放线并拖动
- **THEN** 系统临时暂停，实时更新播放线；松手后从新位置继续播放

##### Scenario: 暂停时拖动
- **WHEN** 用户在暂停状态按住播放线并拖动
- **THEN** 系统实时更新播放线；松手后保持暂停

#### Requirement: 裁剪区定位约束
系统 SHALL 禁止播放位置停留在已裁剪区间；拖动进入裁剪区时按有效内容边界吸附，单击裁剪区时不改变当前位置。

##### Scenario: 单击裁剪区
- **WHEN** 用户单击任意已裁剪区间
- **THEN** 点击不生效，播放线保持原位

##### Scenario: 拖入中间裁剪区
- **WHEN** 用户拖动播放线进入位于两个有效片段之间的裁剪区
- **THEN** 播放线吸附到距离鼠标更近的裁剪区左边界或右边界

##### Scenario: 拖入首尾裁剪区
- **WHEN** 用户拖入从源时间 `00:00` 开始的裁剪区
- **THEN** 播放线只能吸附到该区间右边界；若拖入直达源片尾的裁剪区，则只能吸附到左边界

##### Scenario: 精确有效起点
- **WHEN** 源时间 `00:00` 未被裁剪且用户把播放线拖到最左侧
- **THEN** 播放位置精确为 `0ms`；若开头已裁剪，则最早位置为首个裁剪区右边界

#### Requirement: 已裁剪区悬浮提示
系统 SHALL 复用主题切换按钮所使用的 shadcn Tooltip 展示已裁剪区说明，不使用浏览器原生 `title` 提示。

##### Scenario: 悬浮已裁剪区
- **WHEN** 用户将鼠标悬浮在已裁剪区遮罩上
- **THEN** 系统以项目统一 Tooltip 样式显示“已裁掉 · 点击编辑”，并遵循现有 Tooltip 延迟与碰撞避让规则
