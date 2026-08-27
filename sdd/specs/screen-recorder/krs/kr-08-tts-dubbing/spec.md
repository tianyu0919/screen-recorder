---
id: "kr-08-tts-dubbing"
kind: kr
parent: "screen-recorder"
status: in_progress
impact_radius:
  - "native/tts-helper/"
  - "electron/tts/"
  - "electron/store/"
  - "electron/preload/"
  - "shared/"
  - "src/tts/"
  - "src/store/"
  - "src/components/preview/"
  - "src/export/"
  - "docs/TECH_DESIGN.md"
dependencies:
  - "kr-01-capture-foundation"
  - "kr-03-mp4-export"
  - "kr-05-editor"
  - "kr-06-captions"
---

# Specification: 本地 TTS 配音（按字幕重读与无录音配音）

## 0. Key Result Statement

Lenza SHALL 在 macOS 与 Windows 上以统一的本地 sherpa-onnx 引擎，把会话字幕沿其时间轴合成为非破坏式 TTS 配音轨（占用 mic 轨位），同时覆盖"有录音按字幕重读"与"无录音字幕配音"两种场景，且预览、专注预览与 MP4 导出听感一致。

- **Parent Epic**: [screen-recorder](../../spec.md)
- **Target Metric**: 内置中英双语、中文专用、英文专用三类高质量音色并支持导入 sherpa-onnx VITS 系兼容模型；分段缓存命中时 30 分钟会话重生成仅合成变更段；派生轨与 mic.wav（无录音时与视频时长）严格等长，片尾声画误差 ≤20ms；原始 `mic.wav` 零修改；双平台同模型同文本合成时长一致；双平台预览/导出闭环通过。

## 1. Scope

- **In Scope**: sherpa-onnx 本地引擎（`native/tts-helper`，darwin/win32 统一）；Kokoro v1.1 中英、Matcha Icefall Baker 中文 + Vocos、Kokoro English v0.19 三套官方模型随包内置；用户导入 sherpa-onnx VITS 系兼容模型；按 `captions.json` 字幕段逐段合成 + 保调变速贴合（±20% 阈值）+ 带限重采样与边界淡化 + 拼接为等长派生 WAV；分段哈希缓存与增量重生成；非破坏式替换 mic 轨（有录音 A/B 切换）与虚拟 mic 轨（无录音）；复用 mic 轨增益/静音/裁剪/混音；`edit.json` V3 持久化；双平台打包与 CI 分发。
- **Out of Scope**: 云端 TTS 实际接入（仅留引擎抽象接口）；音色转换/RVC（→ kr-09）；逐字幕段不同音色；录制中实时 TTS；系统音频与自定义音轨的 TTS；TTS 结果的逐词编辑；SSML 细粒度控制。

## 2. Functional Requirements

### ADDED

#### Requirement: 本地 TTS 引擎与音色管理
The system SHALL 以随包内置的 sherpa-onnx helper（darwin / win32 同一源码各自编译）提供中英双语、中文专用、英文专用三类官方音色；官方模型全部随安装包分发，并允许用户导入 sherpa-onnx VITS 系兼容模型。

##### Scenario: 首次启用 TTS
- **WHEN** 用户在含字幕的会话中打开 TTS 配音
- **THEN** 系统展示音色列表（名称、语言、性别/风格说明、试听入口）并明确所有合成均在本机完成，内置模型无需下载即可使用

##### Scenario: 导入自定义模型
- **WHEN** 用户导入 sherpa-onnx VITS 系兼容模型目录
- **THEN** 系统经格式/完整性校验与 helper 探测后登记到 `userData/models/tts/`，以稳定 ID 出现在音色列表；校验失败时不入库并提示原因

##### Scenario: helper 或模型缺失
- **WHEN** 当前平台 helper 缺失/启动失败或所选模型文件不存在
- **THEN** TTS 入口降级为不可用并说明原因，会话其余功能（含原声 mic 轨）不受影响

#### Requirement: 按字幕重读（有录音会话）
The system SHALL 对存在 `mic.wav` 的会话，基于当前 `captions.json` 的文字与时间段逐段合成语音，拼接为与 `mic.wav` 等长的派生 WAV，并非破坏式替换 mic 轨参与预览与导出，原始文件零修改。

##### Scenario: 生成并替换
- **WHEN** 用户选择音色并确认生成
- **THEN** 系统显示分段进度与取消；完成后把派生轨接入 mic 轨位（预览立即生效、不改变当前播放位置），原声可随时一键切回

##### Scenario: 无字幕或字幕为空
- **WHEN** 会话有录音但没有任何字幕段
- **THEN** 系统提示"需先生成或添加字幕"，不允许生成全静音派生轨

##### Scenario: 切回原声
- **WHEN** 用户关闭 TTS 配音或切回原声
- **THEN** mic 轨位立即恢复 `mic.wav`，派生缓存保留以便快速再次启用

#### Requirement: 字幕配音（无录音会话）
The system SHALL 对没有 `mic.wav` 的会话，把手动添加/编辑的字幕按同一管线合成语音，作为该会话的"虚拟 mic 轨"（占用 mic 轨位、以视频时长为等长基准）。

##### Scenario: 静默录屏生成配音
- **WHEN** 无录音会话存在字幕且用户生成 TTS 配音
- **THEN** 派生轨按视频时长生成（无字幕段区间为静音），参与预览、专注预览与导出混音

##### Scenario: 后续补入麦克风轨
- **WHEN** 无录音会话已有虚拟 mic 派生轨，之后出现 `mic.wav`（如未来导入能力）
- **THEN** 原声与 TTS 配音按同一 A/B 语义切换，默认保持用户当前选择

#### Requirement: 时长对齐与溢出处理
The system SHALL 对每段合成语音按字幕时间窗做保调变速贴合（变速不改变音高）：音频超出时间窗时在 +20% 内加速贴合，超出阈值时按端点速率保留并允许溢出（被下一段截断），且在字幕轨上标记溢出段；音频短于时间窗时保持自然语速、剩余窗口留静音（减速贴合会产生可闻机械感，验收后修正为不对称策略）。

##### Scenario: 正常贴合
- **WHEN** 某段 TTS 时长超出字幕窗但偏差在 +20% 内
- **THEN** 该段经保调变速后恰好占满字幕窗，听感无明显变速痕迹，片尾总长度不变

##### Scenario: 超阈值溢出
- **WHEN** 某段即使 +20% 加速仍放不进字幕窗
- **THEN** 按最接近的自然速端点合成并允许溢出（后续静音段吸收），UI 在该字幕段标记溢出提示，用户可通过缩短文字或拉长字幕区间消除

##### Scenario: 长会话等长
- **WHEN** 对 30 分钟会话生成完整派生轨
- **THEN** 派生轨采样率、声道数、总样本数与 `mic.wav`（或视频时长换算）一致，片尾声画误差 ≤20ms，分段拼接边界无可闻爆音

#### Requirement: 分段缓存与增量重生成
The system SHALL 以"字幕段文本 + 音色 ID + 引擎/模型版本"为分段缓存键复用合成结果；字幕文字、时间或音色变化时仅重新合成受影响段，且任务按 `sessionId` 隔离。

##### Scenario: 改一条字幕
- **WHEN** 派生轨已生成且用户仅修改某条字幕的文字
- **THEN** 重新生成时未变更段直接命中缓存，只有变更段重新调用 helper 合成

##### Scenario: 改字幕时间区间
- **WHEN** 用户仅拖动字幕起止时间而文字未变
- **THEN** 复用已缓存的原始合成音频，仅重跑变速贴合与拼接，不重新调用 TTS 引擎

##### Scenario: 换音色
- **WHEN** 用户切换音色
- **THEN** 缓存键变化触发全量重生成；旧音色缓存保留，切回时直接命中

##### Scenario: 会话切换
- **WHEN** 生成期间用户返回会话库或打开其他录屏
- **THEN** 原任务状态只属于原 `sessionId`，完成结果不得显示或写入其他会话

#### Requirement: 预览、编辑与导出一致
The system SHALL 让 TTS 派生轨完全复用 mic 轨的增益、静音、非破坏式裁剪与 N 轨混音逻辑，普通预览、专注预览与 MP4 导出三者一致。

##### Scenario: 调整 mic 增益或静音
- **WHEN** TTS 配音启用且用户修改 mic 轨增益或静音
- **THEN** 预览与导出对派生轨应用相同控制，不同时混入原声

##### Scenario: 存在裁剪区间
- **WHEN** 会话包含裁剪
- **THEN** 派生轨按与 mic.wav 相同的源时间轴映射裁剪，被裁内容不进入预览与导出

##### Scenario: 派生文件丢失或校验失败
- **WHEN** `edit.json` 引用的派生 WAV 不存在或缓存键校验失败
- **THEN** 系统回退原声（无录音会话回退静音）、提示重新生成，并禁止静默导出与预览不一致的结果

#### Requirement: 历史兼容与跨平台确定性
The system SHALL 让没有 TTS 字段的历史 `edit.json`（V1/V2）安全迁移为 TTS 关闭状态，并保证 macOS 与 Windows 使用同一模型与引擎版本时合成结果时长一致。

##### Scenario: 打开历史会话
- **WHEN** 编辑文档版本早于 TTS 功能
- **THEN** 系统按 TTS 关闭加载，其他编辑内容保持不变，保存时升级为 V3

##### Scenario: 双平台同输入合成
- **WHEN** macOS 与 Windows 使用同一模型文件与引擎版本合成同一文本
- **THEN** 输出时长一致（逐样本级或误差 <1ms），音色听感无平台差异，不依赖平台专有音频 API
