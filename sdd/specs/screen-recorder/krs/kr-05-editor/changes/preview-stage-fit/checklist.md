# Verification Checklist: 编辑器舞台自适应与检查器收起

## Functional Verification
- [ ] 默认“适应”模式下，连续调整窗口宽高时 Canvas 始终完整、等比、居中
- [x] 极宽与极高舞台均按正确限制边计算显示尺寸，不出现负数或溢出
- [ ] “100%”模式按 1920×1080 CSS 像素显示，超出区域可双向滚动
- [ ] 从“100%”切回“适应”后恢复自动缩放与居中
- [ ] 检查器可收起和恢复，参数状态不丢失，舞台立即重新适配
- [x] 预览缩放不修改 Canvas backing size、导出分辨率或运镜结果

## Code Quality
- [x] 新增组件和 hook 均不超过 300 行
- [x] 无新增 TypeScript 错误
- [x] 无 debug 日志或注释代码残留

## Testing
- [x] 舞台 fit 纯逻辑 smoke 测试通过
- [x] `npm run typecheck` 通过
- [x] `npm run build` 通过
- [x] 既有导出与音轨专项 smoke 无回归
- [ ] Windows 手动窗口缩放冒烟通过

## Non-Functional
- [x] ResizeObserver 仅在容器尺寸变化时更新，不新增逐帧循环
- [x] 操作按钮具备可见焦点、title 和 aria-label
