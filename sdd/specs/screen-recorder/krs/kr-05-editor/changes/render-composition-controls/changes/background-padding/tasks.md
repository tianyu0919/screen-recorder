# Task Breakdown & Execution Board: 背景画面边距控制 (Tasks)

## Phase 1: 契约与纯逻辑
- [x] Task 1.1: 为 `RenderSettings` 增加画面边距百分比，补齐默认文档、V2 缺字段兼容、非法值回退与范围钳制
- [x] Task 1.2: 让 `resolveOutputPlan` 把合法百分比转换为基于输出短边的 `paddingRatio`，背景关闭时强制为 0

## Phase 2: UI 与渲染接入
- [x] Task 2.1: 在背景图层渐进区域增加 `0%–20%`、步进 `1%` 的“画面边距”滑块并接入自动保存
- [x] Task 2.2: 移除预览与导出中的固定 `0.06`，统一消费输出计划计算值

## Phase 3: 验证与文档
- [x] Task 3.1: 扩展 edit/render smoke，覆盖默认、0%、20%、越界、背景关闭及预览/导出配置一致性
- [x] Task 3.2: 运行 typecheck、ESLint、build、render/edit/export smoke 与 diff 检查
- [x] Task 3.3: 同步技术设计并人工冒烟 macOS 的预览与导出一致性
- [x] Task 3.4: 人工冒烟 Windows 的预览与导出一致性
- [x] Task 3.5: 修复 Windows 运镜时视频越过固定内容窗口导致背景边距视觉偏移，并补齐共享预览/导出合成器裁剪

# Task Dependencies
- [Task 1.2] depends on [Task 1.1]
- [Task 2.1] depends on [Task 1.1]
- [Task 2.2] depends on [Task 1.2]
- [Task 2.1] and [Task 2.2] can run in parallel after [Task 1.1]
- [Task 3.1] depends on [Task 1.1] and [Task 1.2]
- [Task 3.2] depends on [Task 2.1], [Task 2.2] and [Task 3.1]
- [Task 3.3] and [Task 3.4] depend on [Task 3.2] and can run in parallel
- [Task 3.5] depends on [Task 2.2]
