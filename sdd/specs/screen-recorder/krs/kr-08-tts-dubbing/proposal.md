# Proposal: 本地 TTS 配音（按字幕重读与无录音配音） (Proposal)

## 1. Context & Problem Statement

- **Current State**: Lenza 已完成录制后离线字幕闭环（kr-06）：`mic.wav` 经内置 Whisper Small + VAD 本地转写，产出带词级时间戳的 `captions.json`，字幕可编辑、烧录 MP4、导出 SRT。音频侧已有 mic/system 双轨、自定义音轨、分轨增益/静音与非破坏式裁剪。kr-07（本地 DSP 语音包）仍处于 draft，且明确把"字幕 TTS 配音"排除在外。
- **Pain Points**:
  - 用户录音环境差（喷麦、底噪、口误、口音）时，只能重录或忍受，没有"换个好声音"的补救手段；
  - 大量演示录屏（静默操作、纯键盘鼠标演示）没有人声，观众理解成本高，用户想要配音就得额外录音；
  - 手动补录配音很难与画面节奏对齐，而字幕时间轴已经精确描述了"什么时候该说什么"。

## 2. Value Proposition

- **有录音的会话**：一键把真人配音替换为清晰的 TTS 音色（非破坏式，随时切回原声），口误改字幕文字即可局部重生成配音，不用重录。
- **无录音的会话**：手动添加的字幕直接变成配音轨，静默录屏秒变有声演示。
- **隐私与成本**：一期全本地（sherpa-onnx），与 whisper 字幕同一隐私基调，录音与文本不出本机、零调用费用。
- **架构复用**：TTS 产物复用 mic 轨位的增益/静音/裁剪/混音与导出管线，编辑器零新增轨道概念；helper/模型分发模式与 whisper-caption 完全同构，打包与 CI 改造成本低。

## 3. Alternatives Considered

- **Option A：云端 TTS（Azure/OpenAI/火山）**（Cons: 与全本地隐私定位冲突；需 Key 管理与计费；离线不可用。决策：引擎抽象层留接口，一期不实现）
- **Option B：各平台 OS 原生 TTS（macOS AVSpeech / Windows SAPI）**（Cons: 音色/语速/质量双平台不一致；Windows 中文音色依赖系统语言包，很多机器没有；变速贴合要写两套；QA 翻倍。决策：放弃，双平台统一 sherpa-onnx）
- **Option C：音色转换（RVC/seed-vc，保留真人韵律只换音色）**（Cons: 模型大、吃 GPU、授权合规需评估。决策：列二期 kr-09）
- **Option D：TTS 产物作为自定义音轨**（Cons: 用户要手动处理与原 mic 轨的静音关系，心智负担重；与"替换我的声音"语义不符。决策：占用 mic 轨位做非破坏式派生轨，无录音时为虚拟 mic 轨）

## 4. Success Metrics

- [ ] 有录音会话：选择音色 → 生成 → 预览/导出听到 TTS 配音，可一键切回原声，`mic.wav` 零修改
- [ ] 无录音会话：手动字幕 → 生成配音 → 预览/导出有声
- [ ] 修改单条字幕文字后重生成，仅该段重新合成（分段缓存命中）
- [ ] 30 分钟会话派生轨与原轨等长，片尾声画误差 ≤20ms
- [ ] macOS 与 Windows 同一模型同一文本合成时长一致（跨平台确定性）
- [ ] 双平台人工冒烟通过，typecheck/lint/build 无新增错误
