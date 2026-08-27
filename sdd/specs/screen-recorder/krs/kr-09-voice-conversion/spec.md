---
id: "kr-09-voice-conversion"
kind: kr
parent: "screen-recorder"
status: draft
impact_radius:
  - "native/voice-converter/"
  - "electron/voiceConversion/"
  - "shared/"
  - "src/tts/"
  - "src/store/"
  - "src/export/"
dependencies:
  - "kr-08-tts-dubbing"
---

# Specification: 本地音色转换（保留韵律的语音包）

> **占位登记（二期）**：需求澄清阶段已确认「把录音改成 TTS 音包」包含两条路线——按字幕重读（→ [kr-08-tts-dubbing](../kr-08-tts-dubbing/spec.md)，一期）与本 KR 的音色转换（二期）。本 spec 仅登记范围与关键决策，进入实现前需重新走澄清与设计。

## 0. Key Result Statement

Lenza SHALL 在 macOS 与 Windows 上提供本地音色转换能力：保留用户真人录音的韵律、节奏与情感，仅替换音色（RVC / seed-vc 类），产出与 kr-08 一致的 mic 位非破坏式派生轨。

- **Parent Epic**: [screen-recorder](../../spec.md)
- **Target Metric**: 待定（进入实现前澄清：转换质量基线、30 分钟会话处理时长上限、GPU/CPU 降级策略）。

## 1. Scope

- **In Scope**: mic 轨音色转换（保留韵律）；本地推理（ONNX/CoreML，GPU 优先、CPU 降级）；≥2 个转换音色；模型按需下载（体积大，不随包内置）；与 kr-08 共用 mic 位派生轨、A/B 切换、缓存与导出一致性基建。
- **Out of Scope**: 用户声音克隆训练；名人音色；云端转换；实时转换；系统音频/自定义音轨转换。

## 2. Functional Requirements

### ADDED

#### Requirement: 本地音色转换（待澄清细化）
The system SHALL 对 mic 轨执行保留韵律的音色转换，生成等长派生轨并复用 kr-08 的 mic 位替换与一致性语义。

##### Scenario: 应用转换音色（占位）
- **WHEN** 用户选择转换音色并应用
- **THEN** 系统非破坏式生成派生轨并切换 mic 轨位，细节指标待二期澄清

## 3. 已知风险（二期启动前必须解决）

1. **模型授权与合规**：RVC 系模型音色来源与再分发授权需逐一评估；不得分发训练来源不明的音色。
2. **性能**：CPU 推理 30 分钟会话可能超过可接受时长；需评估 CoreML（macOS）/ DirectML 或 CUDA（Windows）加速路径与纯 CPU 降级阈值。
3. **包体**：转换模型显著大于 TTS 模型，按需下载与磁盘占用治理是默认要求。
