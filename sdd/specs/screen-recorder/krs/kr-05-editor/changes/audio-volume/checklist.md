# Verification Checklist: 编辑器音频音量控制

## Functional Verification
- [x] 双轨会话：两条滑杆均可调，预览实时生效、互不影响（代码路径：`useSyncedAudio` volume 参数）
- [x] 单轨会话：缺失轨滑杆禁用（人工确认）
- [x] 无轨会话：「音频」区不渲染（人工确认）
- [x] 导出产物音量与预览一致；默认 100% 时混音无回归（人工确认；默认增益 scalePcm/mixPcm 走原路径，逐样本一致）

## Code Quality
- [x] `npm run typecheck` 无新增类型错误（2026-08-22）
- [x] `npm run build` 通过（2026-08-22）
- [x] 无 debug 日志/注释代码残留

## Non-Functional
- [x] 滑杆拖动不引起播放器卡顿（音量仅写 `<audio>.volume`，不触发重渲染循环）
- [x] 手动冒烟：Windows 平台录制 → 调音量 → 预览/导出
