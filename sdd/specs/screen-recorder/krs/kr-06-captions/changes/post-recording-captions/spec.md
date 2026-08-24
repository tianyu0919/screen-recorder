---
id: "kr-06-post-recording-captions"
kind: change
parent: "kr-06-captions"
status: draft
impact_radius:
  - "native/whisper-caption/"
  - "electron/transcription/"
  - "electron/store/"
  - "electron/preload/"
  - "shared/"
  - "src/store/"
  - "src/components/preview/"
  - "src/render/"
  - "src/export/"
  - "docs/TECH_DESIGN.md"
dependencies:
  - "kr-01-capture-foundation"
  - "kr-02-motion-playback"
  - "kr-03-mp4-export"
  - "kr-05-editor"
---

# Specification: 录制后离线字幕生成与编辑

## 1. Scope

- **In Scope**: 编辑页按需从 `mic.wav` 本地生成字幕；模型按需下载；auto/zh/en；后台任务进度、取消与重试；`captions.json`；字幕轨编辑；全局样式；全局/单段位置；MP4 烧录；裁剪后 SRT；历史会话兼容。
- **Out of Scope**: 录制中实时字幕、AudioWorklet 转写分流、不可捕获悬浮窗；系统音频和自定义音轨转写；云端转写；说话人分离；翻译；逐字高亮；任意字体导入；AI 文案润色。

## 2. Functional Requirements

### ADDED

#### Requirement: 录制后按需生成
系统 SHALL 允许用户在有麦克风轨的录制详情中按需启动本地离线转写，并在完整结果校验成功后原子保存字幕文档。

##### Scenario: 新会话生成字幕
- **WHEN** 用户打开含 `mic.wav` 且尚无字幕的会话并点击“生成字幕”
- **THEN** 系统显示语言和模型档位，确认后进入下载或转写状态，完成后自动出现字幕轨

##### Scenario: 历史会话生成字幕
- **WHEN** 用户打开升级前录制且包含有效 `mic.wav` 的历史会话
- **THEN** 系统允许按相同流程生成字幕，不要求原会话包含任何字幕字段

##### Scenario: 无麦克风轨
- **WHEN** 会话没有 `mic.wav`
- **THEN** 系统禁用生成入口并说明第一期仅支持麦克风字幕，其他预览和导出能力不受影响

#### Requirement: 本地模型管理
系统 SHALL 按需下载用户选择的多语言模型，在校验完整性后加载，并提供轻量与高精度档位。

##### Scenario: 首次使用
- **WHEN** 本机缺少所选模型
- **THEN** 系统在下载前显示体积，下载中显示进度、取消和重试，校验成功后自动继续转写

##### Scenario: 下载损坏
- **WHEN** 下载中断或摘要校验失败
- **THEN** 系统删除临时文件并进入可重试错误态，不加载不完整模型

#### Requirement: 会话级后台任务
系统 SHALL 以 `sessionId` 隔离转写任务，允许用户离开详情或切换会话，并保证旧任务状态和结果不会串入当前会话。

##### Scenario: 切换页面
- **WHEN** 转写期间用户返回会话库或打开其他录屏
- **THEN** 原任务继续在 Main 后台执行，新页面只显示自身会话的状态

##### Scenario: 重复启动
- **WHEN** 同一会话已有下载或转写任务运行
- **THEN** 系统复用现有状态且不启动第二个 helper

##### Scenario: 显式取消
- **WHEN** 用户点击取消
- **THEN** 系统终止 helper、清理临时结果并进入已取消状态，原视频、音频和已有字幕均不改变

#### Requirement: 字幕时间轴编辑
系统 SHALL 提供字幕轨，并允许修改文字、拖动起止时间、分割、合并和删除；所有更新保持在真实源视频范围内。

##### Scenario: 修改字幕
- **WHEN** 用户编辑字幕文字或时间
- **THEN** 时间轴、预览、MP4 和 SRT 使用同一更新结果，原始音视频不变

##### Scenario: 视频存在裁剪
- **WHEN** 字幕覆盖一个或多个非破坏式裁剪区间
- **THEN** 源字幕文档保持不变，预览跳过被裁内容，SRT 和 MP4 使用裁剪后输出时间轴

#### Requirement: 字幕样式与位置
系统 SHALL 支持字体预设、字号、文字颜色、描边、背景颜色与透明度、圆角、对齐、最大宽度和淡入淡出，并允许在画布直接拖动全局或单段位置。

##### Scenario: 修改全局样式
- **WHEN** 用户修改全局字幕样式或默认位置
- **THEN** 所有无位置覆盖的字幕立即更新，编辑预览、专注预览和导出视觉一致

##### Scenario: 单段位置覆盖
- **WHEN** 用户选择一条字幕并启用单段位置调整
- **THEN** 仅该字幕保存归一化位置覆盖，其余字幕继续使用全局位置

##### Scenario: 安全边界
- **WHEN** 字幕被拖至画布边缘或文字超过最大宽度
- **THEN** 字幕整体钳制在输出安全区并按最大宽度换行

#### Requirement: 字幕导出
系统 SHALL 支持独立控制 MP4 字幕烧录和 SRT 导出，并让二者使用同一份已编辑字幕。

##### Scenario: 烧录 MP4
- **WHEN** 用户启用字幕图层并导出视频
- **THEN** 每帧通过统一合成器渲染当前字幕，样式、位置和淡入淡出与预览一致

##### Scenario: 导出 SRT
- **WHEN** 用户选择导出 SRT
- **THEN** 系统输出时间合法递增的裁剪后字幕；跨裁剪区的字幕按保留段分割

#### Requirement: 隐私、兼容与覆盖保护
系统 SHALL 默认在本地处理音频，允许无字幕和字幕损坏的会话正常加载，并在重新生成时保护已编辑字幕。

##### Scenario: 重新生成
- **WHEN** 会话已有字幕且用户点击重新生成
- **THEN** 系统先提示会覆盖文字和时间编辑；只有新结果成功落盘后才替换旧文档

##### Scenario: 转写失败
- **WHEN** helper、模型或音频解析失败
- **THEN** 系统显示可重试错误且不修改已有字幕，不阻断无字幕预览和导出

### REMOVED

#### Requirement: 录制中实时临时字幕
**Reason**: 第一阶段优先保证录屏稳定性和录制后编辑闭环，不把实时推理、AudioWorklet 背压及悬浮窗引入录制热路径。
**Migration**: 保留为后续独立 change；本期所有识别都在 `mic.wav` 完整落盘后由用户按需触发。
