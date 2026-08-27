# Task Breakdown & Execution Board: 本地 TTS 配音 (Tasks)

> 按依赖顺序执行；标注「并行」的任务可同时进行。完成一项勾一项。

## Phase 1: 引擎契约与原生 helper PoC
- [x] Task 1.1: `shared/tts.ts` 定义 TtsVoiceInfo / TtsSegmentRequest / TtsJobProgress / 引擎抽象（`local` 实现，`cloud` 占位），`shared/ttsModels.json` 内置音色清单（id/name/语言/大小/SHA-1，仿 `captionModels.json`）
- [x] Task 1.2: `native/tts-helper/` 接入 sherpa-onnx：CLI 协议（stdin JSON 逐段任务 → 段 WAV 文件 → stdout 结果行），`build.mjs` 挂入 `npm run build:native`（darwin clang++ / win32 cmake 各自编译；v1.12.20 预编译包）
- [x] Task 1.3: 官方模型获取脚本（大小 + SHA-1 校验，挂 `build:native`）内置 Kokoro v1.1 中英、Matcha Icefall Baker 中文 + Vocos、Kokoro English v0.19；darwin 三模型族均跑通“文本 → WAV”，win32 待 CI/实机

## Phase 2: Main 进程服务
- [x] Task 2.1: `electron/tts/{darwin,win32,index}.ts` helper 路径与启动分发（打包后 `resourcesPath/tts-helper/`，开发模式 `native/tts-helper/bin/`）
- [x] Task 2.2: `electron/tts/helper.ts` 子进程协议封装 + `service.ts` 按 sessionId 任务去重/持有/取消（仿 `electron/transcription/service.ts`）
- [x] Task 2.3: `electron/tts/modelManager.ts` 内置模型解析 + 自定义模型导入（校验/探测/原子复制到 `userData/models/tts/` + `registry.json` 稳定 ID）
- [x] Task 2.4: `shared/ipc.ts` + preload 白名单新增 tts 通道（音色列表/生成/取消/进度订阅/试听/导入模型），禁止透传 ipcRenderer

## Phase 3: Renderer 合成管线
- [x] Task 3.1: `src/tts/segments.ts` 字幕段 → 合成任务 + 分段缓存键（sha1 文本+音色+引擎/模型版本）
- [x] Task 3.2: `src/tts/rateFit.ts` 保调变速贴合纯函数（±20% 阈值，超阈值端点速率 + 溢出标记）
- [x] Task 3.3: 等长拼接（48k/2ch/int16，typed-array 切片）——设计修正：改由 Main 侧 `electron/tts/assemble.ts` + `shared/ttsPcm.ts` 承担，零 IPC 传输
- [x] Task 3.4: 会话级派生轨缓存管理（`tts-*.wav` 清单、derivedKey 校验、丢失回退）

## Phase 4: 编辑器集成
- [x] Task 4.1: `shared/edit.ts` + `src/timeline/editDocument.ts` 升级 V3（tts 字段、V1/V2 迁移、原子保存）
- [x] Task 4.2: mic 位音频源解析（原声/派生轨切换），预览（useSyncedAudio）与导出（export/audio.ts）统一消费，增益/静音/裁剪零改动复用
- [x] Task 4.3: 检查器「配音」区 UI（音色列表、试听、生成进度/取消、溢出段标记、A/B 切回原声、失败段重试）
- [x] Task 4.4: 字幕变更联动：改文字/时间 → 受影响段失效标记与增量重生成入口

## Phase 5: 打包、文档与验收
- [ ] Task 5.1: electron-builder.yml `extraResources` + `.github/workflows/release.yml` 双平台纳入 tts-helper 与内置模型；`LENZA_REQUIRE_TTS_HELPER=1` 缺产物即失败（配置已完成；win32 cmake 构建未实机验证，待 CI 首跑后勾选）
- [x] Task 5.2: 更新 `docs/TECH_DESIGN.md`（音频质量、三套模型、会话格式与分发），注册表状态流转
- [ ] Task 5.3: `npm run typecheck` + lint + build 通过；按 checklist.md 逐项验收（typecheck/lint/build/service 级 e2e 已通过；UI 人工冒烟与 win32 实机未做）

# Task Dependencies
- [Task 2.1] depends on [Task 1.2]
- [Task 2.2] depends on [Task 2.1]
- [Task 2.3] depends on [Task 1.1] and [Task 1.3]
- [Task 2.4] depends on [Task 1.1] and [Task 2.2]
- [Task 3.1] depends on [Task 1.1]
- [Task 3.3] depends on [Task 3.1] and [Task 3.2]
- [Task 3.4] depends on [Task 3.3]
- [Task 4.1] depends on [Task 1.1]
- [Task 4.2] depends on [Task 3.4] and [Task 4.1]
- [Task 4.3] depends on [Task 2.4] and [Task 4.2]
- [Task 4.4] depends on [Task 4.3]
- [Task 5.1] depends on [Task 1.3] and [Task 2.1]
- [Task 5.3] depends on [Task 4.4] and [Task 5.1]
- [Task 1.2] and [Task 1.1] can run in parallel；[Phase 3] 与 [Task 2.3] 可并行推进
