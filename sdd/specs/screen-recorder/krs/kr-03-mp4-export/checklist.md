# Verification Checklist: kr-03-mp4-export

> 每条客观可验证，全部勾选后方可关闭本 KR。

## Functional Verification
- [x] 1 分钟会话导出产出 1080p60 H.264 mp4，可被系统播放器正常打开
- [x] 导出帧数 = 时长 × 60，帧率恒定（用 ffprobe 或播放器属性验证），无丢帧
- [x] 导出视频与预览同时间点画面一致（抽查 ≥ 5 个时间点，含运镜进行中的帧）
- [x] 含 mic.wav 的会话导出后声画同步（口型/敲击声与画面对齐）
- [ ] 高/低性能机器导出同一会话，输出帧内容与帧率一致（确定性）
- [x] 导出进度条与已渲染帧数成比例，完成后显示保存路径
- [ ] 导出中途取消后 Worker 终止、无半成品 mp4 残留

## Edge Case Verification
- [ ] H.264 不可用时按 fallback（VP9+webm 或 ffmpeg.wasm 引导）导出成功，并明确告知格式变化
- [ ] 源 webm 损坏/编码不支持时导出中止、提示明确、无残缺文件
- [ ] 渲染耗时超过实时的机器上导出仍帧率恒定、时间戳均匀

## Code Quality & Non-Functional
- [x] 无新增 TypeScript 类型错误与 lint 告警；生产路径无调试残留
- [x] 导出管线与预览复用同一合成器/相机求值代码路径（无复制粘贴的第二份实现）
- [x] 导出期间 Renderer UI 不卡死（重活在 Worker 线程）
- [ ] macOS 与 Windows 双平台导出冒烟通过
