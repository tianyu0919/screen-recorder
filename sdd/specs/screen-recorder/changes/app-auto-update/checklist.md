# Verification Checklist: 应用更新检测与安装

## Functional Verification

- [x] 启动约 10 秒后只检查一次正式 Release，且不会自动下载。
- [x] 自动检查关闭后不在启动时检查，设置重启后仍保留，手动检查仍可用。
- [x] 录制期间自动检查被延期，录制结束后执行，录制热路径没有新增轮询或网络操作。
- [x] 可升级时主题按钮左侧显示升级图标；无更新时不渲染且不占位。
- [x] 升级图标 Tooltip 显示目标版本，点击只打开弹层，不立即下载。
- [x] 主题切换使用 Radix/shadcn Tooltip，DOM 中不存在对应原生 `title`。
- [x] 设置页显示当前版本、自动检查开关、检查按钮及检查中/最新版/错误状态。
- [x] Windows 用户确认后才下载，进度持续更新，失败可重试。
- [x] Windows 下载完成后不会自动退出；用户点击后才重启安装。
- [x] Windows 录制期间“重启并安装”禁用，Main 同时拒绝绕过 UI 的安装请求。
- [x] macOS 未签名构建只打开精确 GitHub Release，不调用应用内下载或安装。
- [x] Draft 与 Pre-release 不会被普通用户检测为可用更新。
- [x] Release notes 缺失、过长或含 HTML 时安全降级，不渲染不受信任内容。
- [x] 断网、GitHub 限流、元数据缺失和更新服务初始化失败均不影响录制、历史、编辑与导出。

## Settings & Compatibility

- [x] V1 `settings.json` 迁移到 V2 后补 `autoCheckUpdates: true`，其余有效设置不变。
- [x] 设置写入仍采用 Main 原子持久化，Renderer 不使用 localStorage 保存更新偏好。
- [x] Windows 与 macOS 差异位于显式平台实现或小型守卫中，Renderer 使用 Main 提供的平台能力。
- [x] 更新 IPC 全部在 `shared/` 定义，preload 只暴露白名单 API。

## Release Verification

- [x] Windows Release 包含 NSIS 安装程序、`latest.yml` 和所需 blockmap。
- [x] macOS Release 包含 DMG、ZIP、`latest-mac.yml` 和所需 blockmap。
- [x] tag 与 `package.json` 版本不一致时流水线配置为明确失败。
- [x] 相邻两个正式版本在 Windows 实机完成发现、下载、重启和升级验证。
- [x] macOS 未签名实机验证 Gatekeeper 降级文案与 Release 跳转，不承诺应用内安装。

## UI & Accessibility

- [x] 更新图标、Tooltip、弹层和设置项在浅色/深色主题下均清晰可辨。
- [x] 所有更新操作可键盘访问，焦点可见，状态变化具有适当的 ARIA 反馈。
- [x] 动效尊重 `prefers-reduced-motion`，无布局跳动或更新入口空白占位。

## Code Quality & Regression

- [x] `npm run lint` 通过且无新增 warning。
- [x] `npm run typecheck` 通过。
- [x] `npm run build` 通过。
- [x] 无生产路径调试日志、原始堆栈或未清理监听器。
- [x] Windows/macOS 原有录制、停止保存、历史、预览、编辑、导出和关闭行为无明显回归。
