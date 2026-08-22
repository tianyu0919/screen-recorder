# Task Breakdown & Execution Board: 应用更新检测与安装

## Phase 1: 契约、设置与依赖

- [x] Task 1.1: 安装 `electron-updater` 为运行时依赖，确认与当前 Electron/electron-builder 版本兼容。
- [x] Task 1.2: 在 `shared/` 定义更新状态、平台能力与 IPC 通道，禁止两端重复类型。
- [x] Task 1.3: 将应用设置迁移为 V2，新增默认开启的 `autoCheckUpdates`，保持原子写入与旧字段兼容。
- [x] Task 1.4: 扩展 preload 白名单与 Renderer 类型声明，提供状态读取、检查、下载、安装、打开 Release 和状态订阅。

## Phase 2: Main 更新服务

- [x] Task 2.1: 新增单例更新服务，封装 updater 初始化、正式频道检查、状态归一化、重复操作守卫和窗口重建订阅。
- [x] Task 2.2: 实现 Windows 检查、用户触发下载、进度、下载完成与 `quitAndInstall`。
- [x] Task 2.3: 实现 macOS 未签名降级：检查后只允许打开精确 Release URL，不调用应用内下载/安装。
- [x] Task 2.4: 对接录制状态：自动检查在录制期间延期，安装在录制期间被 Main 拒绝，录制结束后恢复。
- [x] Task 2.5: 注册更新 IPC，清洗错误和 Release notes，确保 Renderer 不接收原始堆栈或不受信任 HTML。

## Phase 3: Renderer 状态与交互

- [x] Task 3.1: 新增更新 store/hook，初始化当前快照、订阅 Main 推送，并清理监听器。
- [x] Task 3.2: 在主题按钮左侧新增按条件渲染的升级入口，使用现有 Tooltip；将主题按钮的原生 `title` 替换为同组件 Tooltip。
- [x] Task 3.3: 实现轻量更新弹层，覆盖版本、说明、Windows 下载进度/失败重试/重启安装和 macOS Release 跳转。
- [x] Task 3.4: 在录制期间禁用安装并提供原因；确保键盘、焦点、ARIA 和 reduced-motion 行为完整。
- [x] Task 3.5: 设置页增加当前版本、自动检查开关、手动检查和最新版/错误反馈。

## Phase 4: 发布与文档

- [x] Task 4.1: 配置 electron-builder GitHub provider、Windows 更新元数据及 macOS DMG+ZIP 更新产物。
- [x] Task 4.2: 更新 GitHub Actions 上传范围，并增加 tag 与 `package.json` 版本一致性检查。
- [x] Task 4.3: 更新 `docs/TECH_DESIGN.md` 的更新架构、设置 V2、发布产物、签名要求和双平台降级。

## Phase 5: 验证与收尾

- [x] Task 5.1: 运行 lint、typecheck 和生产 build，修复全部新增错误与警告。
- [ ] Task 5.2: 本地验证无更新、断网、重复点击、设置迁移、录制期间延期/禁用和 UI 可访问性。
- [ ] Task 5.3: 使用相邻两个正式版本验证 Windows 从检查到重启安装的完整链路。
- [ ] Task 5.4: 在 macOS 未签名构建验证只检查和打开 Release，绝不进入应用内下载/安装。
- [ ] Task 5.5: 核对 Release 产物、更新 `checklist.md`、本 spec 状态与 `sdd/project.md`。

# Task Dependencies

- [Task 1.4] depends on [Task 1.2] and [Task 1.3].
- [Task 2.1] depends on [Task 1.1] and [Task 1.2].
- [Task 2.2], [Task 2.3] and [Task 2.4] depend on [Task 2.1] and can run in parallel.
- [Task 2.5] depends on [Task 1.4], [Task 2.2], [Task 2.3] and [Task 2.4].
- [Task 3.1] depends on [Task 1.4] and [Task 2.5].
- [Task 3.2], [Task 3.3] and [Task 3.5] depend on [Task 3.1] and can run in parallel.
- [Task 3.4] depends on [Task 3.2] and [Task 3.3].
- [Task 4.1] depends on [Task 1.1]; [Task 4.2] depends on [Task 4.1].
- [Task 4.3] depends on [Task 1.3], [Task 2.5] and [Task 4.2].
- [Task 5.1] depends on all implementation tasks in Phases 1–4.
- [Task 5.2] depends on [Task 5.1]; [Task 5.3] and [Task 5.4] depend on [Task 4.2] and [Task 5.1] and can run in parallel.
- [Task 5.5] depends on [Task 5.2], [Task 5.3] and [Task 5.4].
