# Task Breakdown & Execution Board: kr-02-motion-playback (Tasks)

> 原子任务列表。渲染管线必须从设计上与 kr-03 导出共用（同一合成器，仅时间轴驱动方式不同）。

## Phase 1: 数据模型与关键帧生成
- [ ] Task 1.1: 定义 `CameraState` / `CameraKeyframe` 类型与时间线模型，实现 events.json 加载与 schema 校验
- [ ] Task 1.2: 实现多显示器坐标换算（display.bounds/scaleFactor → 画布坐标）
- [ ] Task 1.3: 实现自动关键帧生成器（点击前 ~200ms 缩放、无操作 N 秒回归 1.0x，参数化：目标倍率/停留时长/回归阈值，含密集点击合并与边界钳制）
- [ ] Task 1.4: 实现 spring 阻尼插值求值器（RK4 积分），支持任意时间点采样相机状态

## Phase 2: WebGL 合成器
- [ ] Task 2.1: 搭建 WebGL 合成器骨架（自研 shader 或 PixiJS），视频纹理按相机状态做仿射变换
- [ ] Task 2.2: 实现背景渐变 + 视频圆角/阴影合成层
- [ ] Task 2.3: 实现点击波纹叠加动画层
- [ ] Task 2.4: 实现超纹理上限的降采样处理与 UI 明示

## Phase 3: 预览播放器
- [ ] Task 3.1: 实现预览播放器（`<video>` + `requestVideoFrameCallback` 驱动渲染循环，播放/暂停）
- [ ] Task 3.2: 实现进度条拖拽 seek（任意时间点相机状态即时求值）
- [ ] Task 3.3: 构建预览界面（zustand 状态接入：会话加载、运镜参数调节面板）

## Phase 4: 集成与验证
- [ ] Task 4.1: 用 kr-01 真实录制会话做集成自测，对照 checklist.md 逐项验证
- [ ] Task 4.2: 清理调试日志与无用代码

# Task Dependencies
- [Task 1.2] depends on [Task 1.1]
- [Task 1.3] depends on [Task 1.2]
- [Task 1.4] depends on [Task 1.1]，与 [Task 1.2]/[Task 1.3] 可并行
- [Task 2.1] depends on [Task 1.1]
- [Task 2.2]、[Task 2.3] depends on [Task 2.1]，两者可并行
- [Task 2.4] depends on [Task 2.1]，与 [Task 2.2]/[Task 2.3] 可并行
- [Task 3.1] depends on [Task 1.4] and [Task 2.2]
- [Task 3.2] depends on [Task 3.1]
- [Task 3.3] depends on [Task 3.1]，与 [Task 3.2] 可并行
- [Task 4.1] depends on [Task 2.3]、[Task 2.4]、[Task 3.2]、[Task 3.3]
- [Task 4.2] depends on [Task 4.1]
