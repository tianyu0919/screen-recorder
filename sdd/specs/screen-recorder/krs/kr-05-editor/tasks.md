# Task Breakdown & Execution Board: kr-05-editor (Tasks)

> 原子任务列表。所有编辑结果必须同时作用于 kr-02 预览与 kr-03 导出（共享同一时间线模型）。

## Phase 1: 编辑数据模型
- [x] Task 1.1: 扩展时间线模型：运镜效果、非破坏式裁剪区间与会话级 edit.json 持久化（由 timeline-editing / interactive-timeline-effects 交付）
- [x] Task 1.2: 实现非破坏式片段删除映射：预览跳过、事件/关键帧时间换算与导出拼接（由 timeline-editing 交付）

## Phase 2: 编辑器 UI
- [x] Task 2.1: 实现时间线运镜效果 UI：可视化、拖拽移动、手动新增/删除、双端拉伸与越界钳制
- [x] Task 2.2: 实现片段选区与非破坏式裁剪交互，编辑后预览即时刷新
- [x] Task 2.3: zustand 编辑状态接入，预览/导出共享同一编辑文档和时间线模型

## Phase 3: 叠加层
- [ ] Task 3.1: 实现 webcam 录制期第二路采集与 webcam.webm 落盘（扩展 kr-01 会话目录）
- [ ] Task 3.2: 实现画中画合成层（位置/尺寸可调），接入合成顺序最末
- [x] Task 3.3: 实现按键回显徽章层（含组合键/高频输入的合并显示策略）

## Phase 4: 集成与验证
- [ ] Task 4.1: 端到端自测：编辑 → 预览 → 导出一致性，对照 checklist.md 逐项验证
- [ ] Task 4.2: 清理调试日志与无用代码

# Task Dependencies
- [Task 1.2] depends on [Task 1.1]
- [Task 2.1] depends on [Task 1.1]
- [Task 2.2] depends on [Task 1.2]，与 [Task 2.1] 可并行
- [Task 2.3] depends on [Task 2.1] and [Task 2.2]
- [Task 3.1] 与 Phase 1/2 可并行（采集侧独立，但需 kr-01 会话结构可扩展）
- [Task 3.2] depends on [Task 3.1]
- [Task 3.3] 与 [Task 3.1]/[Task 3.2] 可并行
- [Task 4.1] depends on [Task 2.3]、[Task 3.2]、[Task 3.3]
- [Task 4.2] depends on [Task 4.1]
