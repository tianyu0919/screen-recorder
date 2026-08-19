# Task Breakdown & Execution Board: kr-04-cursor-beautify (Tasks)

> 原子任务列表。本 KR 依赖 kr-01 预留的 `captureCursor` 采集抽象；原生 helper 属 PoC 性质，失败回退路径必须始终可用。

## Phase 1: 原生采集 helper PoC
- [ ] Task 1.1: macOS Swift helper PoC：ScreenCaptureKit `showsCursor=false` 采集，子进程/N-API 桥接帧到 Electron
- [ ] Task 1.2: Windows WGC helper PoC：`IsCursorCaptureEnabled=false` 采集与桥接
- [ ] Task 1.3: 落地 `captureCursor` 采集抽象：helper 探测、启动失败回退 desktopCapturer、UI 状态提示

## Phase 2: 轨迹平滑
- [ ] Task 2.1: 实现去抖滤波（最小移动阈值），静止场景光标不抖
- [ ] Task 2.2: 实现 catmull-rom 样条插值，生成渲染轨迹并支持任意时间点采样

## Phase 3: 矢量光标重绘
- [ ] Task 3.1: 实现光标渲染层（SVG/高分辨率位图，按 DPR 缩放），接入合成器视频层之上
- [ ] Task 3.2: 实现光标放大倍率与皮肤切换（≥ 2 套皮肤），预览即时生效
- [ ] Task 3.3: 实现旧会话（光标已烧录）检测与重绘层自动关闭

## Phase 4: 集成与验证
- [ ] Task 4.1: 端到端自测：无光标录制 → 平滑轨迹 → 重绘光标 → 预览与导出一致，对照 checklist.md
- [ ] Task 4.2: 清理调试日志与无用代码

# Task Dependencies
- [Task 1.1] 与 [Task 1.2] 可并行（双平台独立开发）
- [Task 1.3] depends on [Task 1.1] or [Task 1.2]（任一平台 helper 可用即可落地抽象）
- [Task 2.1] 与 Phase 1 可并行（纯数据加工，不依赖 helper）
- [Task 2.2] depends on [Task 2.1]
- [Task 3.1] depends on [Task 2.2]
- [Task 3.2] depends on [Task 3.1]
- [Task 3.3] depends on [Task 3.1]，与 [Task 3.2] 可并行
- [Task 4.1] depends on [Task 1.3]、[Task 3.2]、[Task 3.3]
- [Task 4.2] depends on [Task 4.1]
