# Verification Checklist: kr-04-cursor-beautify

> 每条客观可验证，全部勾选后方可关闭本 KR。

## Functional Verification
- [ ] macOS helper 录制产出的视频帧不含系统光标（抽查多帧确认）
- [ ] Windows helper 录制产出的视频帧不含系统光标
- [ ] 无光标会话中重绘光标位置与真实鼠标轨迹重合（目视无可见偏移）
- [ ] 原始轨迹的高频抖动在渲染轨迹中被消除：光标静止时画面光标完全不动
- [ ] 快速长距离移动的平滑轨迹贴合真实路径，无截弯失真
- [ ] 光标放大（如 1.5x）后边缘清晰、无模糊锯齿
- [ ] ≥ 2 套光标皮肤可切换，预览即时生效，导出产物使用所选皮肤
- [ ] 光标重绘在预览与导出（kr-03 管线）中结果一致

## Edge Case Verification
- [ ] 原生 helper 启动失败时回退 desktopCapturer 采集，UI 提示光标美化不可用，录制不中断
- [ ] 旧会话（captureCursor=true）打开时重绘层默认关闭，不出现双光标，并提示原因
- [ ] 多显示器 scaleFactor 场景下重绘光标落点正确（复用 display.bounds/scaleFactor 换算）

## Code Quality & Non-Functional
- [ ] 无新增 TypeScript 类型错误与 lint 告警；生产路径无调试残留
- [ ] `captureCursor: boolean` 抽象真正打通：切换取值可改变采集行为
- [ ] helper 崩溃不影响主进程与录制会话完整性
- [ ] macOS 与 Windows 双平台冒烟通过
