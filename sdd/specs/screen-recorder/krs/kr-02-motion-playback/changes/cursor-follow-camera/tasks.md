# Task Breakdown & Execution Board: 放大运镜鼠标安全区跟随 (Tasks)

## Phase 1: 纯时间轴逻辑
- [x] Task 1.1: 实现鼠标轨迹坐标归一化、放大区间识别与 60% 安全区目标计算
- [x] Task 1.2: 对跟随目标做有界采样与位移阈值降噪，并复用画布边界钳制
- [x] Task 1.3: 按确认后的交互将安全区改为中央 40%（中心横纵各 ±20%）并更新回归

## Phase 2: 预览/导出集成
- [x] Task 2.1: 将稀疏跟随目标并入现有关键帧派生，保持片段倍率覆盖与回归时机不变
- [x] Task 2.2: 验证实时 animator 与离线 `sampleCameraAt` 使用同一结果

## Phase 3: 验证与文档
- [x] Task 3.1: 补充安全区内、越界、边缘钳制、空轨迹和预览/导出一致性回归
- [x] Task 3.2: 运行 typecheck、build、render/export smoke 并同步 TECH_DESIGN
- [ ] Task 3.3: Windows 实机会话目视确认跟随自然、无抖动和黑边

# Task Dependencies
- [Task 1.2] depends on [Task 1.1]
- [Task 1.3] depends on [Task 1.2]
- [Task 2.1] depends on [Task 1.1] and [Task 1.2]
- [Task 2.2] depends on [Task 2.1]
- [Task 3.1] depends on [Task 2.1]
- [Task 3.2] depends on [Task 2.2] and [Task 3.1]
- [Task 3.3] depends on [Task 3.2]
