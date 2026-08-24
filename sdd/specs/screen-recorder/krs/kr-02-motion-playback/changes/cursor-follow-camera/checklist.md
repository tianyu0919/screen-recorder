# Verification Checklist: 放大运镜鼠标安全区跟随

## Functional Verification
- [x] 放大期间鼠标在中央 40%（中心横纵各 ±20%）安全区内移动时相机中心保持稳定
- [x] 鼠标越过安全区后，相机仅沿越界方向平滑追随且 zoom 不变
- [x] 回到 `zoom <= 1.05` 后停止跟随并保持全景中心
- [x] 密集点击仍按原规则合并，新点击焦点优先且随后继续跟随
- [x] `mouseTrack` 为空时保持现有点击运镜行为

## Edge Cases
- [x] 安全区边缘高频小幅移动不导致相机来回抖动
- [x] 鼠标到达画布四边时相机被正确钳制，无黑边穿帮
- [x] 旧会话、裁剪后播放和 seek 均不报错

## Code Quality
- [x] 跟随派生为纯时间轴逻辑，不依赖 DOM 或实时系统光标
- [x] 不修改 events.json 或 shared 数据契约
- [x] 相关文件均不超过 300 行
- [x] 无新增 TypeScript 错误、调试日志或无关依赖

## Testing
- [x] 自动回归覆盖中央 40% 安全区、越界、降噪、边缘与空轨迹
- [x] 同一时间点实时 animator 与离线采样结果一致
- [x] `npm run typecheck`、`npm run build`、render/export smoke 全部通过
- [x] 基础版已完成验收；自然度问题已登记至 `changes/cursor-follow-stability/`

## Non-Functional
- [x] 鼠标轨迹不会按 60–120Hz 全量膨胀为关键帧
- [x] 预览与导出相机结果确定性一致
