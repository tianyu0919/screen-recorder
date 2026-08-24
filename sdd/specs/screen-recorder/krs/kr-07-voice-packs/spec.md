---
id: "kr-07-voice-packs"
kind: kr
parent: "screen-recorder"
status: draft
impact_radius:
  - "shared/"
  - "electron/store/"
  - "electron/preload/"
  - "src/audio-effects/"
  - "src/store/"
  - "src/components/preview/"
  - "src/export/"
  - "docs/TECH_DESIGN.md"
dependencies:
  - "kr-01-capture-foundation"
  - "kr-03-mp4-export"
  - "kr-05-editor"
---

# Specification: 本地语音包与非破坏式变声

## 0. Key Result Statement

Lenza SHALL 在 macOS 与 Windows 编辑器中提供非破坏式本地 DSP 语音包，使用户能把麦克风轨切换为至少四种预设效果并获得与预览一致、严格等长的导出音轨。

- **Parent Epic**: [screen-recorder](../../spec.md)
- **Target Metric**: 至少 4 个非原声预设；30 分钟会话派生轨片尾误差 ≤20ms；原始 `mic.wav` 零修改；双平台预览/导出闭环通过。

## 1. Scope

- **In Scope**: 原声、低沉、清亮、广播、机器人预设；离线 Worker DSP；生成进度/取消/重试；等长派生 WAV；缓存和清理；编辑文档持久化；原声/派生轨 A/B 切换；音量、静音、裁剪和导出混音一致；历史会话迁移。
- **Out of Scope**: 录制中实时变声；RVC/AI 音色转换；名人或用户声音克隆；字幕 TTS 配音；用户导入模型；训练模型；云端推理；系统音频和自定义音轨变声；逐片段不同语音包；第三方音色市场。

## 2. Functional Requirements

### ADDED

#### Requirement: 内置本地语音包
系统 SHALL 为麦克风轨提供原声、低沉、清亮、广播和机器人预设，并以固定、版本化、可复现的 DSP 参数定义非原声效果。

##### Scenario: 浏览语音包
- **WHEN** 用户打开含麦克风轨会话的音频检查器
- **THEN** 系统展示语音包名称、说明、当前状态和试听入口，并明确所有处理均在本机完成

##### Scenario: 无麦克风轨
- **WHEN** 会话没有 `mic.wav`
- **THEN** 系统禁用语音包并说明第一期只处理麦克风，系统音频与自定义音轨保持原样

#### Requirement: 非破坏式离线生成
系统 SHALL 在 Worker 中从原始 `mic.wav` 生成严格等长的派生 WAV，不覆盖、移动或重新编码原始麦克风文件。

##### Scenario: 应用语音包
- **WHEN** 用户选择非原声预设并点击应用
- **THEN** 系统显示进度和取消；成功后保存派生轨并在不改变当前视频位置的情况下切换预览

##### Scenario: 切回原声
- **WHEN** 用户选择原声或关闭语音包
- **THEN** 系统立即恢复 `mic.wav`，既有派生缓存保留以便快速再次选择

##### Scenario: 处理失败
- **WHEN** WAV 解码、DSP、编码或保存失败
- **THEN** 系统删除临时结果、保留当前有效音轨并显示可重试错误

#### Requirement: 时长与听感安全
系统 SHALL 保持派生轨的采样率、声道数、样本数和起点与原始麦克风一致，并在分块处理、增益和调制后避免可闻接缝及数字削波。

##### Scenario: 音高预设
- **WHEN** 低沉或清亮预设修改音高和 formant
- **THEN** 系统不得通过改变 playbackRate 拉长或缩短音轨，输出片尾仍与原轨对齐

##### Scenario: 长会话
- **WHEN** 对 30 分钟麦克风轨生成任一预设
- **THEN** 派生轨总样本数与原轨一致，片尾声画误差不超过 20ms，分块边界无明显爆音

#### Requirement: 会话级任务与缓存
系统 SHALL 以会话、源音频指纹、预设版本和引擎版本生成缓存键，隔离后台任务并复用有效派生资产。

##### Scenario: 重复应用相同预设
- **WHEN** 源音频和版本均未变化且有效缓存存在
- **THEN** 系统直接切换缓存，不重复执行 DSP

##### Scenario: 页面或会话切换
- **WHEN** 生成期间用户返回会话库或打开其他录屏
- **THEN** 原任务状态只属于原 `sessionId`，完成结果不得显示或写入其他会话

##### Scenario: 清理缓存
- **WHEN** 用户执行“清理派生音频”
- **THEN** 系统删除当前未使用的派生文件并报告释放空间，当前使用中的音轨需先回退原声或获得确认

#### Requirement: 预览、编辑与导出一致
系统 SHALL 让当前语音包选择同时作用于普通预览、专注预览和导出，并继续复用麦克风增益、静音和非破坏式裁剪。

##### Scenario: 调整麦克风音量或静音
- **WHEN** 派生语音包启用且用户修改麦克风增益或静音
- **THEN** 预览与导出对派生轨应用相同控制，而不是同时混入原声

##### Scenario: 视频存在裁剪
- **WHEN** 会话包含裁剪区间
- **THEN** 派生轨按与原麦克风相同的源时间轴映射裁剪，声画同步且被裁内容不进入导出

##### Scenario: 派生文件丢失
- **WHEN** 编辑文档引用的派生 WAV 不存在或校验失败
- **THEN** 系统回退原声、提示重新生成，并禁止静默导出与预览不一致的结果

#### Requirement: 历史兼容与跨平台确定性
系统 SHALL 让没有语音包字段的历史 `edit.json` 安全迁移为原声，并在 macOS 与 Windows 使用相同预设和 DSP 语义。

##### Scenario: 打开历史会话
- **WHEN** 编辑文档版本早于语音包功能
- **THEN** 系统按语音包关闭、原声启用加载，其他编辑内容保持不变

##### Scenario: 跨平台处理同一 WAV
- **WHEN** macOS 与 Windows 使用相同引擎版本和预设处理相同输入
- **THEN** 输出时长、峰值安全和主要效果参数一致，不依赖平台专有音频 API
