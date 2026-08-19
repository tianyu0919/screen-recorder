# Task Breakdown & Execution Board: kr-05-editor (Tasks)

> 原子任务列表。所有编辑结果必须同时作用于 kr-02 预览与 kr-03 导出（共享同一时间线模型）。

## Phase 1: 编辑数据模型
- [ ] Task 1.1: 扩展时间线模型：支持手动关键帧（与自动关键帧区分标记）、片段删除区间、编辑数据会话级持久化
- [ ] Task 1.2: 实现片段删除引擎：视频区间裁剪、事件流截断与时间轴前移、关键帧时间戳平移

## Phase 2: 编辑器 UI
- [ ] Task 2.1: 实现时间线编辑器 UI：关键帧可视化、拖拽移动、手动新增/删除，含越界钳制
- [ ] Task 2.2: 实现片段选区与删除交互，删除后预览即时刷新
- [ ] Task 2.3: zustand 编辑状态接入，预览/导出共享同一时间线模型

## Phase 3: 叠加层
- [ ] Task 3.1: 实现 webcam 录制期第二路采集与 webcam.webm 落盘（扩展 kr-01 会话目录）
- [ ] Task 3.2: 实现画中画合成层（位置/尺寸可调），接入合成顺序最末
- [ ] Task 3.3: 实现按键回显徽章层（含组合键/高频输入的合并显示策略）

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
