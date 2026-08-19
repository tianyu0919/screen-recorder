# Task Breakdown & Execution Board: screen-recorder (Tasks)

> 本文件只包含 Epic 级协调任务；各 KR 的原子任务见 `krs/<kr-id>/tasks.md`。

## Phase 1: KR 排期与契约冻结
- [ ] Task 1.1: 冻结录制会话格式契约（`events.json` 类型定义，见 design.md §2），作为 kr-01 输出、kr-02/kr-03 输入的跨 KR 接口
- [ ] Task 1.2: 冻结采集器抽象 `CaptureOptions.captureCursor` 接口，作为 kr-01 与 kr-04 之间的扩展点
- [ ] Task 1.3: 确认 KR 执行顺序：kr-01 → kr-02 → kr-03 为主线；kr-04（原生 helper PoC）可在 kr-01 完成后与主线并行；kr-05 最后启动

## Phase 2: 跨 KR 集成
- [ ] Task 2.1: 集成验证 kr-01 产出的真实录制会话可被 kr-02 预览管线完整加载（会话格式契约回归）
- [ ] Task 2.2: 集成验证 kr-02 的预览渲染管线被 kr-03 导出 Worker 复用（同一代码路径，仅时间轴驱动方式不同）
- [ ] Task 2.3: 集成验证 kr-04 的无光标画面 + 矢量光标重绘接入既有渲染管线（合成顺序：光标层位于视频层之上）
- [ ] Task 2.4: 集成验证 kr-05 编辑器产出的手动关键帧/片段删除结果同时作用于 kr-02 预览与 kr-03 导出

## Phase 3: 整体联调与发布
- [ ] Task 3.1: 端到端联调：录制 1 分钟含点击/键盘操作 → 自动运镜预览 → 导出 1080p60 mp4，对照 Epic checklist 全量验收
- [ ] Task 3.2: macOS 与 Windows 双平台冒烟（含权限引导页、多显示器场景）
- [ ] Task 3.3: 双平台打包发布（electron-builder），验证安装包可运行、原生依赖（uiohook-nap）正确打包

# Task Dependencies
- [Task 1.1] 和 [Task 1.2] 必须先于所有 KR 实现任务完成
- [Task 2.1] depends on kr-01 完成
- [Task 2.2] depends on [Task 2.1] and kr-02、kr-03 完成
- [Task 2.3] depends on kr-04 完成；与 [Task 2.2] 可并行
- [Task 2.4] depends on [Task 2.2] and kr-05 完成
- [Task 3.1] depends on [Task 2.2]、[Task 2.3]、[Task 2.4]
- [Task 3.2] depends on [Task 3.1]
- [Task 3.3] depends on [Task 3.2]
