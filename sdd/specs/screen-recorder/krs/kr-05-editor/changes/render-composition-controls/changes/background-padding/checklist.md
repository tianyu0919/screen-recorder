# Verification Checklist: 背景画面边距控制

## Functional Verification
- [x] 背景开启时显示“画面边距”，范围 `0%–20%`、步进 `1%`、默认 `6%`
- [x] 调整边距时预览立即更新且输出尺寸保持 1920×1080
- [x] `0%` 不增加额外留白，非同宽高比源仍保持等比 letterbox
- [x] 背景关闭时控件隐藏、有效边距为 0，重新开启恢复已保存值
- [x] 预览与导出对相同边距呈现一致的画面大小和位置
- [x] 运镜缩放和平移期间视频保持裁剪在固定内容窗口内，不覆盖或挤偏四边背景

## Compatibility & Data
- [x] 旧 V2 文档缺字段时使用 `6%`，无需升级文档版本
- [x] 非有限值回退 `6%`，有限越界值钳制至 `0%–20%`
- [x] 自动保存和重新打开会话后边距值不丢失

## Code Quality & Testing
- [x] 修改文件均不超过 300 行，共享换算保持纯函数
- [x] edit/render/export 相关 smoke 通过
- [x] `npm run typecheck`、变更文件 ESLint、`npm run build` 与 `git diff --check` 通过
- [x] `docs/TECH_DESIGN.md` 与 `sdd/project.md` 已同步

## Manual Smoke
- [x] macOS：验证 0%、6%、20% 的预览与 MP4 导出一致
- [x] Windows：普通预览与专注预览的固定背景边距一致（2026-08-25 用户实机确认）
