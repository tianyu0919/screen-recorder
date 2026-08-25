# Verification Checklist: kr-01 win32-native-audio

- [x] 普通渲染设备 loopback 采集比特级正确（正弦闭环：播放 0.5 振幅 → 采集 peak 16384）
- [x] VB-Audio 绕行：检测到 "Voicemeeter Input" 默认设备 → 自动改采 "Voicemeeter Out B1"，采集正确
- [x] Voicemeeter 路由自动管理：Strip[3].B1 录制期打开、停止后恢复（引擎电平表验证）
- [x] Remote 不可用 / 找不到 Out 端点：仅告警，回退 loopback，不阻断录制
- [x] 启动延迟静音补齐：system.wav t=0 与画面对齐（pre-roll 段为静音）
- [x] 回声对齐：真实会话互相关估计 +183.3ms（两个独立实现交叉验证一致）
- [x] 耳机用户回归：相关度不足时偏移为 0（算法阈值门控）
- [x] `npm run typecheck` 通过；`npm run build:native` 端到端生成 bin/wasapi-audio.exe
- [x] macOS 回归：darwin.ts / native/sck-audio 零改动（git diff 确认）
- [x] 人工冒烟：Windows 录制 1 分钟（播放音乐 + 说话），预览与导出双向确认无回声
  > 2026-08-21 Windows 实机 115s 会话完成预览/导出验证，互相关偏移 +183.3ms。
- 已移交 Epic：macOS 录制回归（确认重构后 helper spawn 行为不变）。
- 已移交 Epic：无 Voicemeeter 的干净 Windows 机器录制（标准 loopback 路径）。
