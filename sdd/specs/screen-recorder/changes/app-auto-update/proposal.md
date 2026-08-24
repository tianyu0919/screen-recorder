# Proposal: 应用更新检测与安装

## 1. Context & Problem Statement

- **Current State**: Lenza 已通过 Git tag 触发 GitHub Actions，构建 Windows NSIS 与 macOS DMG 并创建 GitHub Release，但应用无法发现新版本，发布产物也未包含 `electron-updater` 所需的更新元数据与 macOS ZIP。
- **Pain Points**: 用户只能自行寻找 Release；无法确认当前是否为最新版；Windows 缺少应用内下载与安装闭环；macOS 当前没有 Developer ID 签名与公证，不能安全启用应用内自动安装。

## 2. Value Proposition

- 在不干扰录制的前提下，让用户及时发现稳定版本更新。
- Windows 提供从发现、确认下载、查看进度到重启安装的完整体验。
- macOS 在未正式签名前采用明确降级，避免下载后被 Gatekeeper 拦截或应用无法启动。
- 复用现有 GitHub Release、版本化设置、IPC 白名单和顶部工具区，保持架构与交互一致。

## 3. Alternatives Considered

- **启动后静默下载**：拒绝。可能在录制期间占用网络、磁盘和 CPU，且用户缺少控制权。
- **macOS 使用 ad-hoc 或自签名证书自动安装**：拒绝。不能建立面向普通用户的可信身份链，无法可靠通过 Gatekeeper 与更新器签名校验。
- **两个平台都只跳转网页**：拒绝。Windows NSIS 已具备实现应用内更新的基础，放弃会显著降低体验。
- **自建更新服务**：拒绝。当前公开 GitHub Release 已能满足稳定频道分发，新增服务没有必要。

## 4. Success Metrics

- [x] 已安装旧版可发现更新后的正式 GitHub Release，忽略 Draft 与 Pre-release。
- [x] Windows 可由用户确认后完成下载，并在非录制状态下重启安装。
- [x] macOS 未签名阶段只跳转对应 Release，不尝试应用内安装。
- [x] 断网、元数据缺失或下载失败不影响录制、编辑、历史与导出。
- [x] 自动检查设置在升级后保留，顶部入口和设置页状态一致。
