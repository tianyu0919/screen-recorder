# Task Breakdown & Execution Board: 编辑器音频音量控制 (Tasks)

## Phase 1: 状态与预览链路
- [x] Task 1.1: previewStore 新增 `audioGain { mic, system }`（0–1，默认 1）+ `setAudioGain`
- [x] Task 1.2: `useSyncedAudio` 增加 volume 参数并应用到 `<audio>.volume`

## Phase 2: 导出链路
- [x] Task 2.1: `mixPcm` 支持双轨增益（含单轨直通缩放 `scalePcm`），int16 clamp 保持
- [x] Task 2.2: `ExportStartMessage` 增加 `audioGain`；exportStore 读取并传递；pipeline 应用

## Phase 3: UI
- [x] Task 3.1: 抽出共用 `ParamRow`（MotionParamsPanel 复用），新增 `AudioPanel` 检查器区
- [x] Task 3.2: PreviewScreen 挂载 AudioPanel；无轨禁用/全无轨不渲染

## Phase 4: 验证
- [x] Task 4.1: `npm run typecheck` + `npm run build` 通过（2026-08-22）
- [ ] Task 4.2: 人工冒烟（Windows）：调节音量 → 预览听感变化；导出产物音量一致

# Task Dependencies
- [Task 1.2] depends on [Task 1.1]
- [Task 2.2] depends on [Task 2.1]
- [Task 3.2] depends on [Task 3.1]
- [Task 1.x] / [Task 2.x] / [Task 3.1] can run in parallel
