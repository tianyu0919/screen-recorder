# Task Breakdown & Execution Board: 录制后离线字幕生成与编辑

## Phase 1: 契约与纯逻辑
- [ ] Task 1.1: 在 `shared/` 定义字幕文档、样式、任务状态、模型状态和 IPC 契约
- [ ] Task 1.2: 实现字幕校验、时间钳制、分割/合并、裁剪映射与 SRT 序列化纯函数
- [ ] Task 1.3: 定义 helper JSON Lines 协议、错误码、取消和进度语义

## Phase 2: 模型与双平台 helper
- [ ] Task 2.1: 建立 `native/whisper-caption` 构建和最小文件转写 smoke
- [ ] Task 2.2: 实现模型清单、按需下载、进度、取消、摘要校验和原子落盘
- [ ] Task 2.3: 实现 `electron/transcription/{index,darwin,win32}.ts` 平台分发和 helper 生命周期
- [ ] Task 2.4: 更新 electron-builder、构建脚本和 Release 流水线以分发双平台 helper 与内置字体

## Phase 3: 后台任务与会话持久化
- [ ] Task 3.1: 实现按 `sessionId` 隔离的 Main 转写任务管理器、状态查询、事件订阅、取消和去重
- [ ] Task 3.2: 实现 `mic.wav` 完整转写、结果校验以及 `captions.json` 原子写入/读取
- [ ] Task 3.3: 接入历史会话、无麦克风、页面切换、应用退出和会话删除的安全行为
- [ ] Task 3.4: Renderer store 接入字幕文档和任务状态，确保异步结果不会跨会话写入

## Phase 4: 字幕编辑 UI
- [ ] Task 4.1: 在检查器实现生成、模型下载、语言、进度、取消、失败重试和覆盖确认
- [ ] Task 4.2: 时间轴新增字幕轨，支持选择、文字修改、拖边、分割、合并和删除
- [ ] Task 4.3: 检查器新增全局字幕样式和位置模式，复用现有颜色、滑杆和分段控件
- [ ] Task 4.4: 舞台增加字幕选择框和位置拖动，支持全局位置与单段覆盖

## Phase 5: 统一预览与导出
- [ ] Task 5.1: 实现 CaptionBitmapRenderer 和内置中文字体加载
- [ ] Task 5.2: Compositor 增加字幕纹理层，普通/专注预览接入句段查询和淡入淡出
- [ ] Task 5.3: 导出 Worker 接入相同字幕渲染实现，保持现有编码背压
- [ ] Task 5.4: 增加字幕烧录开关和 SRT 导出，应用裁剪后时间轴映射

## Phase 6: 验证与文档
- [ ] Task 6.1: 增加字幕区间、裁剪映射、SRT、模型校验和 helper 协议 smoke
- [ ] Task 6.2: 运行 typecheck、lint、build 及既有 render/export/audio 回归
- [ ] Task 6.3: Windows/macOS 人工冒烟：下载、生成、切换页面、编辑、烧录和 SRT
- [ ] Task 6.4: 更新 `docs/TECH_DESIGN.md` 的会话格式、Main 任务、渲染、导出和 helper 打包路径

# Task Dependencies
- [Task 2.x] depends on [Task 1.1] and [Task 1.3]
- [Task 3.1] depends on [Task 1.1]、[Task 1.3] and [Task 2.3]
- [Task 3.2] depends on [Task 1.2]、[Task 2.2] and [Task 2.3]
- [Task 3.3] and [Task 3.4] depend on [Task 3.1] and [Task 3.2]
- [Task 4.x] depends on [Task 3.4]
- [Task 5.1] and [Task 5.4] depend on [Task 1.2]；可与 [Task 4.x] 并行
- [Task 5.2] depends on [Task 5.1]；[Task 5.3] depends on [Task 5.2]
- [Task 6.x] depends on [Task 2.x] through [Task 5.x]
