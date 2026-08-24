# Task Breakdown & Execution Board: 鼠标跟随稳定性与提前响应

## Phase 1: 跟随状态机

- [ ] Task 1.1: 将即时逐点追踪改为稳定锚点、触发阈值与重新激活阈值组成的滞回状态机。
- [ ] Task 1.2: 实现有界轨迹前瞻与方向判断，对稀疏、反向和缺失样本安全降级。
- [ ] Task 1.3: 调整跟随目标和平滑参数，使一次大位移形成单次连续相机移动，并保留画布边界钳制。

## Phase 2: 集成与验证

- [ ] Task 2.1: 保持预览 animator 与离线导出使用同一纯时间轴派生结果，补齐裁剪和 seek 回归。
- [ ] Task 2.2: 增加小幅静止、长距离移动、方向反转、到位后微动、边缘和空轨迹专项 smoke，并同步 `docs/TECH_DESIGN.md`。
- [ ] Task 2.3: 在真实 macOS/Windows 会话中调校阈值，确认无明显抖动、视觉延迟和跟到位后的黏连移动。

# Task Dependencies

- [Task 1.2] depends on [Task 1.1].
- [Task 1.3] depends on [Task 1.1] and [Task 1.2].
- [Task 2.1] depends on [Task 1.3].
- [Task 2.2] depends on [Task 2.1].
- [Task 2.3] depends on [Task 2.2].
