# Task Breakdown & Execution Board: 本地语音包与非破坏式变声

## Phase 1: 契约、预设与持久化
- [ ] Task 1.1: 在 `shared/` 定义 VoicePackPreset、VoiceEffectEdit、生成状态和 IPC 契约
- [ ] Task 1.2: `EditDocument` 升级版本并实现历史文档迁移、非法值归一化和自动保存
- [ ] Task 1.3: 定义内置原声/低沉/清亮/广播/机器人预设及 preset/engine 版本规则
- [ ] Task 1.4: Main 实现 `derived/voices/` 安全路径、原子保存/读取/删除和会话清理

## Phase 2: DSP Worker
- [ ] Task 2.1: 实现 WAV 校验、浮点 PCM 转换、分块处理和等长 WAV 编码基础管线
- [ ] Task 2.2: 实现 pitch shift + formant 调整，并验证不使用改变总时长的 playbackRate
- [ ] Task 2.3: 实现 EQ、压缩、饱和、ring modulation、干湿混合和峰值保护
- [ ] Task 2.4: 实现 Worker 进度、取消、generation token、分块状态/重叠拼接和异常清理
- [ ] Task 2.5: 实现源指纹与缓存键，命中缓存时跳过生成

## Phase 3: 编辑器 UI 与预览
- [ ] Task 3.1: 音频检查器增加语音包入口、卡片、说明、试听、应用、进度、取消和错误重试
- [ ] Task 3.2: Preview store 接入会话级任务和 VoiceEffectEdit，阻止异步结果跨会话写入
- [ ] Task 3.3: 普通/专注预览以派生轨替代 mic，切换时保持视频位置与播放状态
- [ ] Task 3.4: 增加切回原声、缓存状态和派生音频空间清理交互

## Phase 4: 导出与一致性
- [ ] Task 4.1: ExportStartMessage 增加当前麦克风来源，缓存有效时加载派生 WAV 替代 mic
- [ ] Task 4.2: 复用现有麦克风增益、静音、音频对齐、cutPcm 和多轨混音逻辑
- [ ] Task 4.3: 导出前校验派生资产，缺失时阻止静默不一致并提供原声/重新生成选择

## Phase 5: 验证与文档
- [ ] Task 5.1: 增加 DSP 等长、峰值、静音保留、分块接缝、缓存键和迁移 smoke
- [ ] Task 5.2: 使用短语音、5 分钟和 30 分钟 WAV 验证时长、取消、内存与片尾同步
- [ ] Task 5.3: 运行 typecheck、lint、build 和既有 audio/export/render smoke
- [ ] Task 5.4: macOS/Windows 人工冒烟全部预设、A/B 切换、裁剪、静音和导出
- [ ] Task 5.5: 更新 `docs/TECH_DESIGN.md` 的派生资产、编辑文档、预览音轨和导出混音

# Task Dependencies
- [Task 2.x] depends on [Task 1.1] and [Task 1.3]
- [Task 2.5] depends on [Task 1.4] and [Task 2.1]
- [Task 3.1] and [Task 3.2] depend on [Task 1.1]、[Task 1.2] and [Task 2.4]
- [Task 3.3] depends on [Task 2.5] and [Task 3.2]
- [Task 3.4] depends on [Task 1.4] and [Task 3.2]
- [Task 4.x] depends on [Task 2.5] and [Task 3.3]
- [Task 5.x] depends on [Task 1.x] through [Task 4.x]
