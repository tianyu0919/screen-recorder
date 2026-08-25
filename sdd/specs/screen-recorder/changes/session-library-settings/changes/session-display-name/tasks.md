# Task Breakdown & Execution Board: 录像显示名称与内联重命名 (Tasks)

## Phase 1: 契约与持久化
- [x] Task 1.1: 增加共享显示名称校验与 `RecordingSession.displayName` 契约
- [x] Task 1.2: 扩展 SessionCatalog 索引读取、扫描保留和原子重命名持久化
- [x] Task 1.3: 增加 SessionRename IPC 与 preload 白名单 API

## Phase 2: 命名消费者
- [x] Task 2.1: SessionReader 返回显示名称，列表刷新和旧会话保持兼容
- [x] Task 2.2: MP4/WebM 与 SRT 默认文件名使用显示名称并保留无覆盖策略

## Phase 3: UI 与状态同步
- [x] Task 3.1: 实现详情页双击内联编辑、Enter/失焦保存、Escape 取消和就地错误
- [x] Task 3.2: Preview Store 原子同步 current 与 sessions，全部录像卡片显示新名称

## Phase 4: 验证与文档
- [ ] Task 4.1: 增加名称校验与索引持久化 smoke（名称校验 7/7 已通过；索引重启恢复待人工验证）
- [x] Task 4.2: 运行 typecheck、变更文件 lint、build 与人工交互冒烟（自动检查已通过；交互冒烟由双平台项跟踪）
- [ ] Task 4.3: 同步 TECH_DESIGN、项目注册表并完成双平台文件名验证（macOS 已于 2026-08-25 通过，Windows 待验证）

# Task Dependencies
- [Task 1.2] and [Task 1.3] depend on [Task 1.1]
- [Task 2.1] depends on [Task 1.2]
- [Task 2.2] depends on [Task 1.1] and [Task 1.2]
- [Task 3.1] and [Task 3.2] depend on [Task 1.3] and [Task 2.1]
- [Task 4.x] depends on [Task 1.x] through [Task 3.x]
