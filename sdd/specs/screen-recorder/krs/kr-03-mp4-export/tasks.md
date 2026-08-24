# Task Breakdown & Execution Board: kr-03-mp4-export (Tasks)

> 原子任务列表。导出必须复用 kr-02 的合成器与相机求值器，仅替换时间轴驱动方式。

## Phase 1: 解码与基础设施
- [x] Task 1.1: 搭建导出 Worker 线程骨架与 Renderer ↔ Worker 消息协议（开始/进度/取消/完成）
- [x] Task 1.2: 接入 mediabunny demux + WebCodecs VideoDecoder，实现按时间戳精确取帧
- [x] Task 1.3: 实现 H.264 能力探测（VideoEncoder.isConfigSupported）与 fallback 决策逻辑（VP9+webm / ffmpeg.wasm 提示）

## Phase 2: 逐帧渲染与编码封装
- [x] Task 2.1: 实现时间轴驱动器（t = 0, 1/60, 2/60 ...），复用 kr-02 合成器渲染到 OffscreenCanvas
- [x] Task 2.2: 实现 VideoEncoder 逐帧编码（VideoFrame 喂入、关键帧策略）
- [x] Task 2.3: 接入 mp4-muxer 封装 mp4，Blob 写盘
- [x] Task 2.4: 实现 mic.wav 音频混入（AudioEncoder 或 ffmpeg.wasm，AAC）

## Phase 3: UI 与交互
- [x] Task 3.1: 实现导出入口、进度条与完成/失败提示（zustand 状态接入）
- [x] Task 3.2: 实现导出取消与资源清理

## Phase 4: 集成与验证
- [x] Task 4.1: 导出与预览一致性自测（同时间点帧比对），对照 checklist.md 逐项验证
- [x] Task 4.2: 清理调试日志与无用代码

## Phase 5: 剩余边界与双平台验收
- [ ] Task 5.1: 在性能差异明显的两台机器导出同一会话并核对帧数、时间戳与抽样帧内容。
- [ ] Task 5.2: 验证导出取消会终止 Worker，并确认目标目录不存在半成品文件。
- [ ] Task 5.3: 强制 H.264 不可用路径，验证 VP9+webm fallback 与格式变化提示。
- [ ] Task 5.4: 使用损坏/不支持的源 webm 验证友好错误和残缺文件清理。
- [ ] Task 5.5: 模拟单帧渲染慢于实时，验证输出时间戳仍均匀且帧率恒定。
- [ ] Task 5.6: 完成 macOS 与 Windows 真实会话导出冒烟并关闭 checklist。

# Task Dependencies
- [Task 1.2] depends on [Task 1.1]
- [Task 1.3] depends on [Task 1.1]，与 [Task 1.2] 可并行
- [Task 2.1] depends on [Task 1.1] and kr-02 合成器可用
- [Task 2.2] depends on [Task 2.1] and [Task 1.3]
- [Task 2.3] depends on [Task 2.2]
- [Task 2.4] depends on [Task 1.2]，与 [Task 2.2]/[Task 2.3] 可并行
- [Task 3.1] depends on [Task 2.3]
- [Task 3.2] depends on [Task 1.1]，与 [Task 3.1] 可并行
- [Task 4.1] depends on [Task 2.4]、[Task 3.1]、[Task 3.2]
- [Task 4.2] depends on [Task 4.1]
- [Task 5.1] through [Task 5.5] depend on [Task 4.2] and can run in parallel
- [Task 5.6] depends on [Task 5.1] through [Task 5.5]
