---
id: "kr-08-high-quality-bundled-voices"
kind: feature
status: in_progress
impact_radius:
  - "shared/ttsModels.json"
  - "shared/ttsModels.ts"
  - "shared/ttsPcm.ts"
  - "native/tts-helper/"
  - "electron/tts/"
  - "src/components/preview/TtsPanel.tsx"
  - "electron-builder.yml"
  - ".github/workflows/release.yml"
  - "docs/TECH_DESIGN.md"
dependencies:
  - "kr-08-tts-dubbing"
---

# Specification: 高质量内置中英文 TTS 音色

## 1. Scope

- **In Scope**: 内置 Kokoro v1.1 中英模型、Matcha Icefall Chinese Baker 中文模型、Kokoro English v0.19 英文模型；精选并命名稳定音色；helper 支持 Kokoro/Matcha 模型族；移除 Melo、Theresa、Fanchen 官方资源与下载入口；带限重采样、WSOLA 修正、段边界淡化；双平台打包与质量验收。
- **Out of Scope**: 兼容或迁移本地测试期旧 TTS 会话；主动删除用户录屏目录中的旧派生 WAV；CosyVoice、IndexTTS、Supertonic、KittenTTS；音色克隆；云端 TTS；逐字幕段选择不同音色。

## 2. Functional Requirements

### ADDED

#### Requirement: 三套高质量官方模型全部内置
The system SHALL 随 macOS 与 Windows 安装包完整分发 Kokoro v1.1 中英、Matcha Icefall Chinese Baker 中文、Kokoro English v0.19 英文三套模型，安装后离线可用且不触发模型下载。

##### Scenario: 查看官方音色
- **WHEN** 用户在离线环境打开配音面板
- **THEN** 面板同时提供“中英双语、中文专用、英文专用”三类经过质量筛选的音色，全部可直接试听和生成

##### Scenario: 双平台打包资源完整
- **WHEN** CI 构建 macOS 或 Windows 安装包
- **THEN** helper、三套模型及所有词典/声码器资源均进入固定 resourcesPath，任一必需资源缺失时构建失败

#### Requirement: 模型族统一接入
The system SHALL 让同一个原生 helper 根据模型清单加载 Kokoro、Matcha 或既有自定义 VITS 模型，并保持逐段 stdin/stdout 协议、缓存、取消与进度语义一致。

##### Scenario: 切换模型族
- **WHEN** 用户从中英 Kokoro 切换到中文 Matcha 或英文 Kokoro 并重新生成
- **THEN** 服务使用对应模型族创建新任务，旧缓存键不误命中，生成结果仍通过同一 mic 轨位进入预览和导出

##### Scenario: 当前运行时不兼容
- **WHEN** 固定 sherpa-onnx 版本不能加载任一目标模型
- **THEN** 构建阶段统一升级并固定双平台相同版本，禁止某个平台继续使用旧运行时

#### Requirement: 派生音频质量保护
The system SHALL 使用带限重采样、有效范围内的保调 WSOLA 与段边界淡化生成 48kHz/2ch/int16 派生轨，不引入可闻电音、爆音、重复音节或断续。

##### Scenario: 不同采样率模型组装
- **WHEN** 22.05kHz、24kHz 或其他合法采样率的原始分段 WAV 被组装到 48kHz 派生轨
- **THEN** 使用带限重采样，语音高频无明显镜像、毛刺或金属感，时长换算误差不超过一个输出采样帧

##### Scenario: 段落进入和结束
- **WHEN** TTS 段从静音进入、回到静音或被下一字幕段截断
- **THEN** 有效语音边界使用短淡入淡出，不出现单样本硬跳变或可闻爆音

##### Scenario: 超长段变速
- **WHEN** 原始语音超出字幕窗且需要在 +20% 内保调加速
- **THEN** WSOLA 不越界、不补入异常静音，输出无明显颤音、重复音节或电音；超阈值语义沿用 kr-08

#### Requirement: 固定语料质量门禁
The system SHALL 对候选 sid 使用覆盖中英文、数字、日期、缩写、标点、长短句的固定语料生成原始段与最终派生轨，并在进入内置清单前完成人耳抽听和数据级边界检查。

##### Scenario: 候选 sid 质量不稳定
- **WHEN** 某候选音色在固定语料出现明显电音、错读、重复、漏读或跨平台听感异常
- **THEN** 该 sid 不进入最终音色列表，其他合格 sid 不受影响

### MODIFIED

#### Requirement: 本地 TTS 引擎与音色管理
官方音色改为三套随包内置模型，不再包含需下载的官方音色。用户导入的自定义 VITS 模型仍可独立存在，但不计入官方高质量音色集合。

##### Scenario: 首次启用 TTS
- **WHEN** 用户首次在含字幕会话中启用配音
- **THEN** 所有官方音色立即可用，不显示模型大小、下载、取消或重试入口

### REMOVED

#### Requirement: Melo、Theresa 与 Fanchen 官方音色
**Reason**: 真实语料验证发现部分旧 VITS 音色原始输出存在严重高频毛刺和电音，且现有音色结构不能满足中英双语与中英文专用模型并存的要求。
**Migration**: 不提供 voiceId 映射或旧测试会话迁移；旧引用按模型缺失处理，不主动删除用户录屏目录。

#### Requirement: 非内置官方音色按需下载
**Reason**: 本变更要求所有官方音色随安装包内置，Fanchen 下载路径不再有产品用途。
**Migration**: 删除官方音色下载清单、UI 状态和服务入口；自定义模型导入不受此项移除影响。
