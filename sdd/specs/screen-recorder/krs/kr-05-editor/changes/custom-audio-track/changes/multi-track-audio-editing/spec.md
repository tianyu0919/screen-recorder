---
id: "kr-05-multi-track-audio-editing"
kind: change
parent: "kr-05-custom-audio-track"
status: draft
impact_radius:
  - "shared/edit.ts"
  - "src/timeline/editDocument.ts"
  - "src/store/previewStore.ts"
  - "src/components/preview/"
  - "src/export/"
  - "electron/store/editStore.ts"
  - "docs/TECH_DESIGN.md"
dependencies:
  - "kr-05-custom-audio-track"
  - "kr-05-interactive-timeline-effects"
---

# Specification: 多轨音频时间线与片段裁剪

## 1. Scope

- **In Scope**: 原始录音波形下方的自定义音轨列表；一轨多片段；创建、重命名、删除、音量和静音；片段波形、水平定位、跨轨移动、双端非破坏裁剪和删除；V1 编辑文档迁移；自动保存；预览与导出一致；长时间线可视区性能。
- **Out of Scope**: 音频分割快捷键；关键帧音量自动化；淡入淡出、变速、降噪、均衡器与声道映射；磁性链接视频片段；撤销/重做；改变录制期 mic/system 采集格式。

## 2. Functional Requirements

### ADDED

#### Requirement: 分层音轨时间线
系统 SHALL 在录制音频波形下方展示独立的自定义音轨，每条轨道拥有固定轨道头和可横向滚动的片段区域。

##### Scenario: 新建音轨
- **WHEN** 用户点击“+ 音轨”
- **THEN** 系统在自定义音轨区域末尾新增一条空轨，默认名称按顺序生成且可重命名

##### Scenario: 多轨浏览
- **WHEN** 自定义音轨数量超过可用高度
- **THEN** 轨道区域可纵向滚动，轨道头与对应片段行始终对齐，原始录音波形不会与自定义片段混在同一行

#### Requirement: 一轨多片段
系统 SHALL 允许每条自定义音轨放置多个不重叠的音频片段，并允许把片段移动到其他轨道。

##### Scenario: 向已有轨道添加多个素材
- **WHEN** 用户在同一轨道依次添加多个音频文件
- **THEN** 每个文件形成独立波形片段，拥有自己的名称、位置、裁剪范围和片段增益

##### Scenario: 跨轨移动
- **WHEN** 用户拖动片段并越过另一轨道的有效放置区域
- **THEN** 片段切换到目标轨道，时间位置按指针保持并在松手后自动保存

##### Scenario: 同轨冲突
- **WHEN** 拖动或添加会与同轨现有片段重叠
- **THEN** 系统显示冲突态并吸附到最近合法位置，不静默覆盖或截断任一片段

#### Requirement: 片段定位与裁剪
系统 SHALL 通过片段主体调整时间位置，通过左右手柄调整原素材保留区间；所有编辑均为非破坏式。

##### Scenario: 裁剪片段头尾
- **WHEN** 用户拖动片段左侧或右侧手柄
- **THEN** 波形与时间范围实时更新，保留区间钳制在原素材内且不短于 100ms

##### Scenario: 重新定位裁剪后的片段
- **WHEN** 用户拖动已裁剪片段主体
- **THEN** `offsetMs` 更新而 `trimStartMs`、`trimEndMs` 保持不变，预览从新位置播放同一素材区间

#### Requirement: 轨道控制
系统 SHALL 为每条自定义音轨提供名称、0–100% 音量、静音和删除，并保留片段级增益与删除能力。

##### Scenario: 轨道静音和音量
- **WHEN** 用户静音轨道或调整轨道音量
- **THEN** 该轨所有片段在预览与导出中同时应用相同轨道增益，其他轨道不受影响

##### Scenario: 删除非空轨道
- **WHEN** 用户删除包含片段的轨道
- **THEN** 系统二次确认将同时移除其中片段，取消确认不产生变化

#### Requirement: 编辑文档迁移与恢复
系统 SHALL 将多轨结构持久化为版本化编辑文档，并无损读取既有扁平自定义音频数据。

##### Scenario: 打开 V1 编辑文档
- **WHEN** `edit.json` 只有扁平 `customAudio` 列表
- **THEN** 系统按时间冲突分配到最少数量的轨道，保持每个片段的位置、裁剪、增益和资产引用

##### Scenario: 重开多轨工程
- **WHEN** 用户完成多轨编辑并重新打开会话
- **THEN** 轨道顺序、名称、增益、静音和全部片段编辑完整恢复

#### Requirement: 预览与导出一致
系统 SHALL 从同一份轨道与片段快照调度预览并生成导出混音，轨道增益、静音、片段增益、位置和裁剪结果一致。

##### Scenario: 多轨混音导出
- **WHEN** 多条轨道在同一时间段发声并导出
- **THEN** 输出包含所有未静音片段，起止位置与预览一致且混音执行既有防削波处理

##### Scenario: 资产缺失
- **WHEN** 某片段引用的会话音频资产缺失
- **THEN** 该片段显示不可用并被预览/导出跳过，其他轨道继续工作

#### Requirement: 多轨编辑性能
系统 SHALL 保持静态波形与逐帧播放头更新隔离，并按时间可视范围降低波形渲染量。

##### Scenario: 多轨连续播放
- **WHEN** 时间线包含至少 5 条轨道和 20 个片段并连续播放
- **THEN** 播放头和画面无因 React 全轨逐帧重渲染导致的明显卡顿

### MODIFIED

#### Requirement: 自定义音频添加入口
原“添加音频”操作 SHALL 支持选择现有目标轨道或新建轨道；右键某轨道时默认添加到该轨道，右键空白区时可创建新轨并添加。

##### Scenario: 从目标轨添加
- **WHEN** 用户在某条轨道选择“添加音频”
- **THEN** 新片段优先放入该轨播放头位置附近的最近合法区间
