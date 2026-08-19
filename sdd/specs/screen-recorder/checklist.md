# Verification Checklist: screen-recorder

> Epic 级验收。所有条目客观可验证，全部勾选后方可将 Epic 标记为 completed。

## Functional Verification
- [ ] 5 个 KR（kr-01 ～ kr-05）各自的 checklist 全部勾选、状态均为 completed
- [ ] 端到端闭环通过：录制 ≥ 1 分钟（含鼠标移动、点击、键盘输入）→ 自动运镜预览播放 → 导出 1080p60 mp4，全程无阻断错误
- [ ] 导出视频与预览画面内容一致（同一渲染管线），帧率恒定 60fps
- [ ] 事件与视频时间轴对齐误差 < 50ms（kr-01 验收在端到端场景下复测仍成立）

## Platform Verification
- [ ] macOS 冒烟通过：屏幕录制权限 + 辅助功能权限引导页正常，拒绝授权时有明确提示而非崩溃
- [ ] Windows 冒烟通过：选屏录制、全局输入采集、导出全链路正常
- [ ] 多显示器场景冒烟通过：非主屏录制的事件坐标经 display.bounds/scaleFactor 换算后运镜落点正确

## Robustness Verification
- [ ] 磁盘空间不足时录制可安全终止并保留已落盘会话片段，有用户可读提示
- [ ] uiohook-nap 钩子启动失败时降级为仅画面 + 鼠标轨迹录制，并明确提示自动运镜不可用
- [ ] WebCodecs H.264 不可用的环境按 fallback（VP9+webm 或 ffmpeg.wasm）仍可导出，不产出损坏文件
- [ ] 录制中拔插显示器：轮询不崩溃、录制不中断（kr-01 未实测项，移交至此）
- [ ] 录制窗口源时关闭该窗口：录制安全停止、已落盘片段保留、提示"采集源已断开"（kr-01 未实测项，移交至此）

## Release Verification
- [ ] macOS 与 Windows 安装包（electron-builder 产物）均可安装并运行完整闭环
- [ ] 安装包中原生依赖（uiohook-nap、后续原生采集 helper）加载正常
