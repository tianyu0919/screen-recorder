# Task Breakdown & Execution Board: 录制后离线字幕生成与编辑

## Phase 1: 契约与纯逻辑
- [x] Task 1.1: 在 `shared/` 定义字幕文档、样式、任务状态、模型状态和 IPC 契约
- [x] Task 1.2: 实现字幕校验、时间钳制、分割/合并、裁剪映射与 SRT 序列化纯函数
- [x] Task 1.3: 定义 helper 结果解析、错误码、取消和进度语义

## Phase 2: 模型与双平台 helper
- [x] Task 2.1: 建立 `native/whisper-caption` 构建和最小文件转写 smoke
- [x] Task 2.2: 实现模型清单、按需下载、进度、取消、摘要校验和原子落盘
- [x] Task 2.3: 实现 `electron/transcription/{index,darwin,win32}.ts` 平台分发和 helper 生命周期
- [x] Task 2.4: 更新 electron-builder、构建脚本和 Release 流水线以分发双平台 helper

## Phase 3: 后台任务与会话持久化
- [x] Task 3.1: 实现按 `sessionId` 隔离的 Main 转写任务管理器、状态查询、事件订阅、取消和去重
- [x] Task 3.2: 实现 `mic.wav` 完整转写、结果校验以及 `captions.json` 原子写入/读取
- [x] Task 3.3: 接入历史会话、无麦克风、页面切换、应用退出和会话删除的安全行为
- [x] Task 3.4: Renderer store 接入字幕文档和任务状态，确保异步结果不会跨会话写入

## Phase 4: 字幕编辑 UI
- [x] Task 4.1: 在检查器实现生成、模型下载、语言、进度、取消、失败重试和覆盖确认
- [x] Task 4.2: 时间轴新增字幕轨，支持选择、文字修改、拖边、分割、合并和删除
- [x] Task 4.3: 检查器新增全局字幕样式和位置模式，复用现有颜色、滑杆和分段控件
- [x] Task 4.4: 舞台增加字幕选择框和位置拖动，支持全局位置与单段覆盖

## Phase 5: 统一预览与导出
- [x] Task 5.1: 实现 CaptionBitmapRenderer 和跨平台中文字体 preset 映射
- [x] Task 5.2: Compositor 增加字幕纹理层，普通/专注预览接入句段查询和淡入淡出
- [x] Task 5.3: 导出 Worker 接入相同字幕渲染实现，保持现有编码背压
- [x] Task 5.4: 增加字幕烧录开关和 SRT 导出，应用裁剪后时间轴映射

## Phase 6: 验证与文档
- [x] Task 6.1: 增加字幕区间、裁剪映射、SRT、模型校验和 helper 协议 smoke
- [x] Task 6.2: 运行 typecheck、lint、build 及既有 render/export/audio 回归
- [x] Task 6.3: 关闭本 change 的自动与代码验收：生成、切换页面、编辑、烧录和 SRT 的实现链路已落地，caption/transcription smoke 已通过。
  > 移交父级 kr-06 checklist：Windows/macOS 完整人工端到端回归。
- [x] Task 6.4: 更新 `docs/TECH_DESIGN.md` 的会话格式、Main 任务、渲染、导出和 helper 打包路径

## Phase 7: 字幕增强
- [x] Task 7.1: 为 `captions.json` 增加会话级 enabled 迁移，新录像默认关闭，关闭时隐藏并停用完整字幕链路
- [x] Task 7.2: 增加 Whisper 词级时间戳、VAD 模型下载及按停顿/标点/长度的一句话重组
- [x] Task 7.3: 开启时自动下载/解析，关闭时取消任务并增加渐进披露动效
- [x] Task 7.4: 自动保存状态扩展为 pending/saving/saved/error，并提供失败重试
- [x] Task 7.5: 时间轴右键添加默认 2 秒字幕并立即编辑
- [x] Task 7.6: 增加 SRT 文件选择、原始时间轴解析、替换确认与规范化导入
- [x] Task 7.7: 中文识别默认使用高精度模型与明确语言提示，并用 OpenCC 将中文结果统一为简体
- [x] Task 7.8: 补齐 caption/transcription smoke、typecheck/build/lint 并同步技术设计。
  > 移交父级 kr-06 checklist：完整双平台实机回归。

## Phase 8: 内置 Small 与可持久化自定义模型
- [x] Task 8.1: 将固定档位契约改为稳定模型 ID 清单，并为 `captions.json` 增加可选生成模型元数据与历史迁移
- [x] Task 8.2: 在 Main 实现跨平台内置 Small/VAD 路径解析、自定义模型原子导入、格式/摘要/helper 探测、注册表和安全删除
- [x] Task 8.3: 增加模型导入/删除白名单 IPC，确保 Renderer 不传递或持久化任意可执行路径
- [x] Task 8.4: 更新字幕面板模型下拉、导入入口、删除确认、缺失模型回显及会话重入选择恢复
- [x] Task 8.5: 更新 electron-builder、开发/Release 构建与双平台资源校验，将 Small/VAD 放入 Windows/macOS `resourcesPath/whisper-models/`
- [x] Task 8.6: 移除 Base 下载与档位入口（未上线，连同旧缓存兼容一并移除），并更新 `docs/TECH_DESIGN.md`
- [x] Task 8.7: 补充注册表、导入失败、删除、历史文档、缺失模型与路径安全 smoke，运行 typecheck/lint/build
- [x] Task 8.8: 关闭模型链路自动验收：内置模型/注册表/导入删除/缺失降级 smoke 已通过。
  > 移交父级 kr-06 checklist：安装包级 Windows/macOS 离线首次生成、导入、重入回显、删除、缺失降级和重新生成实机回归。

# Task Dependencies
- [Task 2.x] depends on [Task 1.1] and [Task 1.3]
- [Task 3.1] depends on [Task 1.1]、[Task 1.3] and [Task 2.3]
- [Task 3.2] depends on [Task 1.2]、[Task 2.2] and [Task 2.3]
- [Task 3.3] and [Task 3.4] depend on [Task 3.1] and [Task 3.2]
- [Task 4.x] depends on [Task 3.4]
- [Task 5.1] and [Task 5.4] depend on [Task 1.2]；可与 [Task 4.x] 并行
- [Task 5.2] depends on [Task 5.1]；[Task 5.3] depends on [Task 5.2]
- [Task 6.x] depends on [Task 2.x] through [Task 5.x]
- [Task 8.2] depends on [Task 8.1]；[Task 8.3] depends on [Task 8.2]
- [Task 8.4] depends on [Task 8.1] and [Task 8.3]
- [Task 8.5] and [Task 8.4] can run in parallel
- [Task 8.6] depends on [Task 8.2]、[Task 8.4] and [Task 8.5]
- [Task 8.7] depends on [Task 8.1] through [Task 8.6]；[Task 8.8] depends on [Task 8.7]
