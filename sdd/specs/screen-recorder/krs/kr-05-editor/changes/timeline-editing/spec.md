---
id: "kr-05-timeline-editing"
kind: change
parent: "kr-05-editor"
status: completed
impact_radius:
  - "src/components/preview/"
  - "src/store/previewStore.ts"
  - "src/store/exportStore.ts"
  - "src/timeline/"
  - "src/export/"
---

# Change: 时间轴编辑（缩放平移 / 片段级倍率 / 非破坏式裁剪）

## 背景

kr-05 编辑器的第一步落地。交付三件事：时间轴的缩放/平移/跟随交互、运镜片段级倍率覆盖
（全局 1.8x 但某一段 2.0x）、非破坏式裁剪（原始 events.json/视频不动，预览与导出按
裁剪后时间轴生效）。裁剪以"丢弃区间"模型实现，替代 kr-05 原 scope 中"事件流与视频
同步截断"的破坏性方案。

## Functional Requirements

### ADDED

#### Requirement: 时间轴缩放与平移
The system SHALL 支持滚轮以光标为锚点连续缩放时间范围（1x 适配宽度至 12x）、
触控板横滑与按住拖动平移，刻度间隔随缩放级别自适应。

##### Scenario: 滚轮缩放
- **WHEN** 用户在时间轴上滚动滚轮/触控板捏合
- **THEN** 时间范围以光标下时间点为锚平滑缩放，不漂移、不带动页面其他区域

##### Scenario: 播放跟随与用户接管
- **WHEN** 播放中播放头越出视口死区（15%~85%）
- **THEN** 视口缓动跟随；用户滚轮/拖动后 1.5s 接管期内不自动跟随，停手后恢复

#### Requirement: 运镜片段级倍率覆盖
The system SHALL 允许选中时间轴上的运镜片段并在检查器单独调整倍率；
密集点击合并出的片段（含多个 zoom-in 关键帧）整段统一覆盖；
覆盖按片段锚点时间存储，修改全局参数后仍生效；预览与导出结果一致。

##### Scenario: 单独调整某段倍率
- **WHEN** 用户点击运镜片段并拖动「选中片段 · 片段倍率」
- **THEN** 仅该段按新倍率渲染，其余段保持全局值；「恢复全局值」可撤销

#### Requirement: 非破坏式裁剪
The system SHALL 支持在刻度尺框选裁剪区间（拖边改范围/按住移动/确认或放弃），
原始 events.json 与视频文件不变；预览播放跳过裁剪区（暂停态 seek 同样吸附），
导出按"输出时间轴 = 源时间轴 - 裁剪区间"逐帧映射渲染，音频按同一映射拼接。

##### Scenario: 框选并裁剪
- **WHEN** 用户在刻度尺拖出区间并点「裁掉这段」
- **THEN** 区间以斜纹遮罩呈现，走带时间码显示裁剪后时长，播放与导出跳过该段

##### Scenario: 编辑已裁区间
- **WHEN** 用户单击已裁区间并点「编辑此段」
- **THEN** 区间退回可编辑选区（拖边/移动后可重新确认，或关闭彻底恢复），不直接删除

##### Scenario: 尾部裁剪
- **WHEN** 裁剪区直达片尾（如 10s 视频裁 8s–10s）
- **THEN** 播放停在保留段最后一帧（不显示被裁内容），导出时长 = 裁剪后时长

##### Scenario: 音频一致性
- **WHEN** 导出含裁剪区间的会话
- **THEN** 音轨按 outputToSourceMs 同一映射拼接（cutPcm），声画同步不漂移

#### Requirement: 刻度尺与时长准确性
The system SHALL 让刻度尺首（00:00）尾（总时长）锚定贴边、中间刻度按缩放密度分配、
尾标签右对齐不越界、中间刻度不与尾标签重名；
webm 缺 Duration 元数据时加载即探针 seek 解析真实时长（onEnded 校正兜底）。

##### Scenario: 最小缩放级别
- **WHEN** 时间范围缩至 1x
- **THEN** 刻度文字不超出内容区右边界，不出现重名时间戳与尾部死区

## 设计约束

- 裁剪/倍率覆盖均**仅存内存**（会话切换清空），不落盘、不改 events.json；
  持久化见「后续计划」（2026-08-21 与需求方确认：坚持非破坏式，原始数据永不丢弃）
- 源↔输出时间换算唯一来源：`src/timeline/cuts.ts`（预览 usePlayback 与导出 pipeline 共用）
- 片段合并规则唯一来源：`src/timeline/segments.ts`（时间轴渲染与覆盖匹配共用）
- 性能规则见 AGENTS.md「性能优化规则」（rVFC 帧驱动、ref 存高频值、异步 seek 守卫等）

## 后续计划（已确认方向，未实施）

**编辑状态按会话持久化**：用户确认保留非破坏式模型的前提下，希望每个会话的编辑操作
可保存、重进会话可还原。规划方案：

- 会话目录新增 `edit.json`（与 events.json 并列，独立文件，原始数据不动），内容：
  `{ version, cuts, zoomOverrides, motionParams }`
- Main 侧：loadSession 附带读取 edit.json 原文；新增 `session:saveEdit` IPC 落盘
  （Renderer 在 cuts/倍率/全局参数变更后防抖 ~400ms 写入）
- Renderer 侧：openSession 解析 edit.json 并宽松校验（损坏则忽略按无编辑处理），
  还原 cuts / zoomOverrides / motionParams 后走既有 derive 派生
- 契约类型（SessionEdit）放 shared/types.ts，SessionLoadResult 增加 editJson 字段
