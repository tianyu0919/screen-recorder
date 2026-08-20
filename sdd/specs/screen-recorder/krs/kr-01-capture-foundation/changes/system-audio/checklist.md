# Verification Checklist: kr-01 system-audio

- [x] 整屏录制（系统播放声音中）后，会话目录存在 system.wav 且可被标准播放器打开
- [x] screen.webm 仍为纯视频轨（无音轨），events.json 格式与字段不变
- [x] 预览播放含系统声音的会话：系统声音与麦克风声音都可闻且与画面同步；暂停/seek 同步
- [x] 导出含 system.wav + mic.wav 的会话：mp4 音轨为两轨混合，声画同步
- [x] 仅有 mic.wav（无系统声音）的旧会话：预览/导出行为与改动前一致（回归）
- [x] 平台/源不支持系统音频时录制不报错、不落盘 system.wav
- [x] `npm run typecheck` / `npm run build` / 全部 smoke 脚本通过
- [x] 人工冒烟：macOS 录制 1 分钟（播放音乐 + 说话），预览与导出双向确认
