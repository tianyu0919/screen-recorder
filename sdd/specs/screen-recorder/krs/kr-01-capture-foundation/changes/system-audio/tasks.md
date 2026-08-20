# Tasks: kr-01 system-audio（系统音频采集）

- [x] Task 1: 采集——按平台分路：Windows 走 getDisplayMedia loopback（关语音处理，画面 MediaRecorder 只用 video track 建流，系统音轨单独 MediaRecorder → 停止时转 system.wav 落盘）；macOS loopback 不可用（electron#52738），走原生 helper（native/sck-audio，ScreenCaptureKit 全系统回采，Main 录制开始 spawn / 停止时 stdin EOF 关停）→ system.wav 落盘
- [x] Task 2: 读取——loadSession 返回 systemAudioUrl（存在才非 null）
- [x] Task 3: 预览——system + mic 双 <audio> 轨同步播放（抽取公共同步 hook，复用现有 mic 同步逻辑）
- [x] Task 4: 导出——audio.ts 混合 system.wav + mic.wav 为单轨再编码 AAC；缺任一轨退化为单轨
- [x] Task 5: 验证——typecheck/build/smoke 全绿 + 人工冒烟（录带系统声音的会话，预览可闻、导出有声）

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 2]
- [Task 4] depends on [Task 2]，与 [Task 3] 可并行
- [Task 5] depends on [Task 3] and [Task 4]
