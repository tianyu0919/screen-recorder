# Task Breakdown & Execution Board: 本地实时字幕与字幕编辑

> **暂停执行**：本任务板属于原实时双遍方案。第一期仅执行
> [post-recording-captions/tasks.md](./changes/post-recording-captions/tasks.md)，实时字幕任务留待后续独立 change。

## Phase 1: 契约与纯逻辑
- [ ] Task 1.1: 在 `shared/` 定义字幕文档、样式、位置、模型状态和 IPC 契约
- [ ] Task 1.2: 实现字幕校验、时间钳制、分割/合并、裁剪映射与 SRT 序列化纯函数
- [ ] Task 1.3: 定义 helper JSON Lines 协议、实时队列上限和错误码

## Phase 2: 本地模型与原生转写
- [ ] Task 2.1: 建立 `native/whisper-caption` 双平台构建与 whisper.cpp/VAD 集成
- [ ] Task 2.2: 实现模型清单、按需下载、进度、取消、摘要校验和原子落盘
- [ ] Task 2.3: 实现 `electron/transcription/{index,darwin,win32}.ts` helper 生命周期与静默降级
- [ ] Task 2.4: 更新 electron-builder、构建脚本和 release 流水线以分发双平台 helper 与内置字体

## Phase 3: 录制中临时字幕
- [ ] Task 3.1: 调整麦克风获取时机并记录 `micOffsetMs`，避免首次授权导致整体偏移
- [ ] Task 3.2: 新增 AudioWorklet：混单声道、重采样 16kHz、约 500ms 分块并实施背压
- [ ] Task 3.3: 接入实时 start/chunk/stop 与 partial/final 临时段状态
- [ ] Task 3.4: 新增不可被录制的悬浮字幕窗及不支持排除捕获时的安全降级

## Phase 4: 最终转写与会话持久化
- [ ] Task 4.1: 停录后后台完整转写 `mic.wav`，支持生成中/完成/失败/重试状态
- [ ] Task 4.2: 原子写入和读取 `captions.json`，历史会话无文件时保持兼容
- [ ] Task 4.3: 编辑器 store 接入字幕文档与操作，确保所有更新产生新引用

## Phase 5: 字幕编辑 UI
- [ ] Task 5.1: 时间轴新增可见性降级的字幕轨与段选择
- [ ] Task 5.2: 支持文字修改、时间拖边、分割、合并、删除及撤销入口
- [ ] Task 5.3: 检查器新增全局字幕样式和位置模式，复用现有颜色/滑杆/分段控件
- [ ] Task 5.4: 舞台增加字幕选择框、直接拖动、全局位置与单段位置覆盖

## Phase 6: 统一预览与导出
- [ ] Task 6.1: 实现 CaptionBitmapRenderer 与内置中文字体加载
- [ ] Task 6.2: Compositor 增加字幕纹理层，预览接入句段查询和淡入淡出
- [ ] Task 6.3: 导出 Worker 接入相同字幕纹理渲染和背压
- [ ] Task 6.4: 导出控制增加烧录开关与 SRT 选择，应用裁剪后时间轴映射

## Phase 7: 验证与文档
- [ ] Task 7.1: 增加字幕区间、裁剪映射、样式钳制、SRT 和 helper 协议 smoke
- [ ] Task 7.2: 运行 typecheck、build、既有 render/export/audio smoke 与字幕专项回归
- [ ] Task 7.3: Windows/macOS 人工冒烟：下载模型、实时字幕、最终转写、编辑、烧录与 SRT
- [ ] Task 7.4: 更新 `docs/TECH_DESIGN.md` 的录制、会话格式、渲染、导出和双平台 helper 路径

# Task Dependencies
- [Task 2.x] depends on [Task 1.1] and [Task 1.3]
- [Task 3.2] depends on [Task 1.3]；[Task 3.1] 与 [Task 2.x] 可并行
- [Task 3.3] depends on [Task 2.3] and [Task 3.2]
- [Task 3.4] depends on [Task 3.3]
- [Task 4.1] depends on [Task 2.3] and [Task 3.1]
- [Task 4.2] and [Task 4.3] depend on [Task 1.1]；可与 [Task 3.4] 并行
- [Task 5.x] depends on [Task 4.2] and [Task 4.3]
- [Task 6.1] and [Task 6.4] depend on [Task 1.2]；可与 [Task 5.x] 并行
- [Task 6.2] depends on [Task 6.1]；[Task 6.3] depends on [Task 6.2]
- [Task 7.x] depends on [Task 2.x] through [Task 6.x]
