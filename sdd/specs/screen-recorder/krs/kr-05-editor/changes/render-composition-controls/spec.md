---
id: "kr-05-render-composition-controls"
kind: change
parent: "kr-05-editor"
status: in_progress
impact_radius:
  - "shared/edit.ts"
  - "src/timeline/"
  - "src/store/"
  - "src/components/preview/"
  - "src/render/"
  - "src/export/"
dependencies:
  - "kr-05-interactive-timeline-effects"
  - "kr-05-audio-volume"
  - "kr-05-custom-audio-track"
  - "kr-05-preview-stage-fit"
  - "kr-03-mp4-export"
---

# Specification: 运镜、静音与背景画布控制 (Specification)

## 1. Scope

- **In Scope**: 运镜总开关与参数渐进披露；1.0x 最低倍率；禁用态时间轴；麦克风、系统和自定义音频独立静音；可选纯色背景图层；HEX、预设色和系统颜色输入；源尺寸或 1920×1080 输出；编码能力降档；预览/导出一致性；edit.json V2 迁移。
- **Out of Scope**: 背景图片、渐变、模糊和自定义画布尺寸；分段运镜独立开关；声像/淡入淡出；透明视频导出；用户手动选择编码器档位。

## 2. Functional Requirements

### ADDED

#### Requirement: 运镜总开关与渐进披露
The system SHALL 在检查器提供默认开启的“启用运镜”开关，并仅在开启时展示目标倍率、停留时长和回归阈值。

##### Scenario: 关闭运镜
- **WHEN** 用户关闭“启用运镜”
- **THEN** 预览与导出固定为 1.0x 全局视图，运镜参数收起，点击波纹与键盘提示继续显示

##### Scenario: 恢复运镜
- **WHEN** 用户重新开启运镜
- **THEN** 原运镜片段、全局参数与单段倍率原样恢复，不重新生成或丢失编辑

##### Scenario: 最低倍率
- **WHEN** 用户调整全局或选中片段的目标倍率
- **THEN** 可选择的最低值为 1.0x，预览与导出使用相同倍率

#### Requirement: 禁用态运镜时间轴
The system SHALL 在运镜关闭时保留时间轴运镜块的上下文，但以明显弱化样式展示并禁止编辑。

##### Scenario: 查看禁用片段
- **WHEN** 运镜关闭且时间轴存在片段
- **THEN** 片段仍可见但降低强调度，并通过提示说明需先启用运镜

##### Scenario: 阻止编辑
- **WHEN** 用户尝试新增、拖动、拉伸、删除或修改禁用的运镜片段
- **THEN** 系统不改变编辑数据，也不触发自动保存

#### Requirement: 可恢复的分轨静音
The system SHALL 为麦克风、系统音频和每条自定义音频提供独立静音按钮，并把 mute 与 gain 分开持久化。

##### Scenario: 静音和恢复
- **WHEN** 用户在增益为 65% 时静音并再次取消静音
- **THEN** 静音期间预览/导出有效增益为 0，滑杆仍显示 65%，恢复后继续使用 65%

##### Scenario: 重开会话
- **WHEN** 用户保存后重新打开含静音轨道的会话
- **THEN** 每条轨道的静音状态和原增益均被恢复

#### Requirement: 可选纯色背景图层
The system SHALL 在检查器提供默认关闭的背景图层开关，开启后提供纯色预设、系统颜色输入和可编辑 HEX。

##### Scenario: 开启背景
- **WHEN** 用户开启背景
- **THEN** 预览与导出使用 1920×1080 画布，将源内容等比居中，并用所选纯色填充留白

##### Scenario: 修改颜色
- **WHEN** 用户选择预设色、系统颜色或输入合法 `#RRGGBB`
- **THEN** 背景立即更新并自动保存，三种控件展示同一规范化颜色

##### Scenario: 非法颜色
- **WHEN** HEX 输入不是完整的六位颜色
- **THEN** 系统显示校验状态且不覆盖最后一个合法颜色

#### Requirement: 源尺寸输出与编码降档
The system SHALL 在背景关闭时按录制源宽高输出；若目标尺寸超出设备编码能力，则等比缩小并明确展示实际尺寸。

##### Scenario: 选色后关闭背景
- **WHEN** 用户开启背景、选择任意颜色后再次关闭背景
- **THEN** 系统保留该选色供下次开启恢复，但预览与导出立即停止使用该颜色填充透明留白

##### Scenario: 原始尺寸可编码
- **WHEN** 录制源为 3456×2234 且设备支持该配置
- **THEN** 预览输出比例和导出尺寸均为 3456×2234，画面无 padding 或背景

##### Scenario: 原始尺寸不可编码
- **WHEN** 设备不支持目标尺寸
- **THEN** 系统选择可用的最大等比偶数尺寸，预览与导出一致，并显示“实际输出 W×H”

### MODIFIED

#### Requirement: 按源边缘合成内容
合成器 SHALL 移除对录制内容强制施加的圆角、阴影和蓝色渐变，并按输出计划绘制真实矩形边缘。

##### Scenario: 无背景渲染
- **WHEN** 背景关闭
- **THEN** 源内容完整填充输出画布，不出现额外底色、留白、圆角或阴影

##### Scenario: 有背景渲染
- **WHEN** 背景开启且源内容未填满 16:9 画布
- **THEN** 仅空余区域显示所选纯色，源内容边缘保持原始形状

#### Requirement: 编辑文档 V2 兼容迁移
系统 SHALL 将运镜开关、音频静音和背景设置写入 edit.json V2，并无损读取 V1 文档。

##### Scenario: 打开 V1 会话
- **WHEN** 会话只有 V1 edit.json
- **THEN** 运镜默认开启、所有音轨默认不静音、背景默认关闭且默认色为 `#16181D`

##### Scenario: 自动保存并恢复
- **WHEN** 用户修改任一新增设置且保存成功
- **THEN** 重开会话后该设置恢复，且预览与导出使用相同值
