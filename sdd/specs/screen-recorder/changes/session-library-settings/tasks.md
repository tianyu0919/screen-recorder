# Task Breakdown & Execution Board: 会话库、回收站与应用设置

## Phase 1: 契约与持久化基础
- [x] Task 1.1: 在 `shared/` 定义版本化设置、会话索引、生命周期、可用性及 IPC 契约。
- [x] Task 1.2: 实现 Main 设置仓储：默认值、schema 校验、版本迁移和原子写入。
- [x] Task 1.3: 实现独立会话索引仓储及旧 `userData/recordings` 的无搬迁登记。

## Phase 2: 多路径会话与回收站
- [x] Task 2.1: 让 `SessionStore` 使用当前保存路径，并默认创建系统视频目录下的 `Lenza` 文件夹。
- [x] Task 2.2: 重构会话枚举/加载为多根索引，区分可用、根不可访问和源文件缺失。
- [x] Task 2.3: 实现安全的移入回收站、恢复、永久删除、清空和失效索引移除。
- [x] Task 2.4: 实现启动清理、运行期定时清理、失败保留和重试节流。
- [x] Task 2.5: 补齐 preload 白名单与 Renderer store actions，禁止 Renderer 直接访问文件系统。

## Phase 3: 设置与平台关闭行为
- [x] Task 3.1: 实现设置读取/更新、选择目录和打开目录的 Main IPC。
- [x] Task 3.2: 按平台拆分 Windows 托盘与 macOS Dock 隐藏/恢复行为。
- [x] Task 3.3: 接管窗口关闭请求，实现首次确认、仅本次选择和持久化默认策略。
- [x] Task 3.4: 分别处理 Windows 媒体文件占用释放与 macOS activate/单窗口生命周期。

## Phase 4: UI 与交互
- [x] Task 4.1: 历史页新增“全部录制 / 回收站”、数量、空状态和刷新状态。
- [x] Task 4.2: 重构会话卡片操作区，加入删除、恢复、永久删除、失效索引移除和确认弹窗。
- [x] Task 4.3: 实现倒计时显示、运行期更新、清理失败和操作 loading/成功反馈。
- [x] Task 4.4: 新增应用设置入口与面板，覆盖主题、路径、保留周期和关闭行为。
- [x] Task 4.5: 新增跨平台关闭确认弹窗，保证键盘、focus、ARIA 和 reduced-motion 可用。

## Phase 5: 文档与验证
- [x] Task 5.1: 更新 `docs/TECH_DESIGN.md` 的存储目录、索引、IPC 和平台路径设计。
- [x] Task 5.2: 运行 lint、typecheck、build，并修复所有新增问题。
- [x] Task 5.3: 在 Windows 验证托盘，在 macOS 验证 Dock；冒烟多路径、删除、恢复和到期清理。

# Task Dependencies
- [Task 1.2] and [Task 1.3] depend on [Task 1.1].
- [Task 2.1] through [Task 2.4] depend on [Task 1.2] and [Task 1.3].
- [Task 2.5] depends on [Task 2.2] through [Task 2.4].
- [Task 3.1] depends on [Task 1.2].
- [Task 3.2] depends on [Task 1.1] and can run in parallel with [Task 2.1] through [Task 2.4].
- [Task 3.3] depends on [Task 3.1] and [Task 3.2].
- [Task 3.4] depends on [Task 2.3] and [Task 3.2].
- [Task 4.1] through [Task 4.4] depend on [Task 2.5] and [Task 3.1].
- [Task 4.5] depends on [Task 3.3] and [Task 3.4].
- [Task 5.1] depends on the final architecture from [Task 1] through [Task 3].
- [Task 5.2] and [Task 5.3] depend on all implementation tasks.
