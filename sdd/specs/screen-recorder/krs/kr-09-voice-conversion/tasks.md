# Task Breakdown & Execution Board: 本地音色转换 (Tasks)

> 占位任务板（二期）。进入实现前先完成澄清与设计，再细化任务。

## Phase 0: 澄清与设计（前置）
- [ ] Task 0.1: 重新走需求澄清：质量基线、处理时长上限、GPU/CPU 降级、音色授权合规结论
- [ ] Task 0.2: 选型验证 PoC：候选引擎（seed-vc / RVC ONNX）在 macOS 与 Windows 目标机型上的质量与耗时实测

## Phase 1: 引擎与基建
- [ ] Task 1.1: `native/voice-converter/` 或 ONNX Runtime 集成（GPU 优先、CPU 降级）
- [ ] Task 1.2: 模型按需下载与磁盘治理（复用 kr-08 模型管理）
- [ ] Task 1.3: 复用 kr-08 mic 位派生轨接入转换产物（等长、A/B、缓存键含转换引擎版本）

## Phase 2: 集成与验收
- [ ] Task 2.1: 编辑器音色入口与 kr-08 语音包统一交互
- [ ] Task 2.2: 双平台验收（质量、时长、导出一致性）

# Task Dependencies
- [Task 1.x] depends on [Task 0.x]
- [Task 1.3] depends on kr-08-tts-dubbing 完成
- [Phase 2] depends on [Phase 1]
