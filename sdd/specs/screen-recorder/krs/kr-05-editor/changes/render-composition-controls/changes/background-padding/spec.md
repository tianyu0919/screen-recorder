---
id: "kr-05-background-padding"
kind: change
parent: "kr-05-render-composition-controls"
status: in_progress
impact_radius:
  - "shared/edit.ts"
  - "src/timeline/editDocument.ts"
  - "src/store/"
  - "src/components/preview/BackgroundPanel.tsx"
  - "src/render/"
  - "src/export/"
dependencies:
  - "kr-05-render-composition-controls"
---

# Specification: 背景画面边距控制 (Specification)

## 1. Scope

- **In Scope**: 背景图层开启时提供统一四边画面边距；范围 `0%–20%`、步进 `1%`、默认 `6%`；按输出画布短边计算；自动保存；预览与导出一致；旧会话安全默认和异常值钳制。
- **Out of Scope**: 横纵边距独立设置；每片段不同边距；裁切填充、拉伸或改变 1920×1080 输出尺寸；背景图片、渐变和模糊。

## 2. Functional Requirements

### ADDED

#### Requirement: 可调画面边距
The system SHALL 在背景图层开启时提供“画面边距”百分比滑块，并将录制画面等比居中放置在背景画布内。

##### Scenario: 调整边距
- **WHEN** 用户在背景图层开启时把画面边距从 `6%` 调整为 `12%`
- **THEN** 预览立即按输出短边的 `12%` 作为四边额外留白，输出尺寸保持 1920×1080，并自动保存该值

##### Scenario: 零边距
- **WHEN** 用户把画面边距设为 `0%`
- **THEN** 系统不增加额外留白，但源比例与输出比例不同产生的必要 letterbox 仍被保留

##### Scenario: 背景关闭
- **WHEN** 用户关闭背景图层
- **THEN** 边距控件隐藏且有效边距为 `0%`，保存的百分比不被删除，重新开启后恢复原值

#### Requirement: 兼容持久化与统一渲染
The system SHALL 将画面边距写入现有 edit.json V2，并由输出计划统一提供给预览与导出合成器。

##### Scenario: 打开旧会话
- **WHEN** edit.json V2 不含画面边距字段
- **THEN** 系统使用默认 `6%`，不升级文档版本且不阻断会话打开

##### Scenario: 非法持久化值
- **WHEN** 持久化边距不是有限数值或超出 `0%–20%`
- **THEN** 非数值回退为 `6%`，有限数值被钳制到合法范围

##### Scenario: 预览与导出
- **WHEN** 用户以任意合法边距完成预览并导出
- **THEN** 两条管线使用相同的 `paddingRatio`，画面大小和位置一致
