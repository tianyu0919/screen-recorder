# Design: 应用更新检测与安装

## 1. Architecture

- Main 进程新增 `electron/updater/` 模块，独占 `electron-updater`、版本检查、下载、安装和平台能力判断。
- Renderer 不直接使用 Node、GitHub API 或更新器，通过 `shared/` 类型、IPC 通道与 preload 白名单访问。
- 平台能力由 `electron/updater/index.ts` 薄分发：Windows 实现检查、下载与安装；macOS 未正式签名阶段实现检查结果展示和打开 Release URL。
- 更新 UI 复用现有顶部工具区、设置面板、Radix/shadcn Tooltip 与设计 token；不使用原生 `title`。
- 自动检查在应用 ready 且窗口建立后延迟约 10 秒执行；录制状态由 Main 掌握，录制期间推迟检查或安装。
- 发布继续由 `.github/workflows/release.yml` 管理，electron-builder 生成 `app-update.yml`、平台更新元数据、blockmap 和所需安装包。

## 2. Data Model & Interfaces

```typescript
type UpdateState =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string; releaseName?: string; releaseNotes?: string }
  | { state: 'not-available'; checkedAt: number }
  | { state: 'downloading'; version: string; percent: number; transferred: number; total: number }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; operation: 'check' | 'download' | 'install'; message: string }

interface UpdateCapabilities {
  canDownloadInApp: boolean
  canInstallInApp: boolean
  reason?: 'macos-unsigned'
}

interface AppSettingsV2 {
  version: 2
  // 保留 V1 全部字段
  autoCheckUpdates: boolean
}
```

新增 IPC 语义：

- `update:get-state`：读取当前状态、当前版本和平台能力。
- `update:check`：执行用户主动检查。
- `update:download`：Windows 用户确认后下载。
- `update:install`：Windows 下载完成后重启安装。
- `update:open-release`：macOS 打开当前更新对应的 GitHub Release。
- `update:status-changed`：Main 向 Renderer 推送状态快照。

设置迁移由现有 `AppSettingsStore` 完成：V1 缺少字段时补 `autoCheckUpdates: true`，保留其余有效值并原子写入 V2。

## 3. Data Flow & Interaction

1. Main 初始化设置、录制 IPC 和窗口后创建单例更新服务，并将状态订阅绑定到当前窗口。
2. 若自动检查开启，约 10 秒后检查；若正在录制则登记一次待检查，在录制结束后执行。
3. 更新器只查询公开仓库的正式 Release。发现新版本后推送 `available`。
4. Renderer 在主题切换左侧渲染升级图标；Tooltip 显示版本，点击打开轻量更新弹层。
5. Windows 用户点击“立即下载”后调用 Main，更新器推送下载进度；完成后显示“重启并安装”。
6. 若正在录制，安装按钮禁用并解释原因；录制结束后恢复，只有用户点击才调用 `quitAndInstall`。
7. macOS 弹层显示未签名降级说明，点击操作打开该版本 GitHub Release，不触发下载或替换 `.app`。
8. 设置页展示当前版本、自动检查开关、手动检查入口及最近结果；顶部与设置页消费同一状态源。

## 4. Release Artifacts

- `electron-builder.yml` 配置公开 GitHub publish provider。
- Windows NSIS 构建并发布安装程序、`latest.yml` 与 blockmap。
- macOS 同时构建 DMG 和 ZIP，并发布 `latest-mac.yml` 与 blockmap，为未来正式签名后启用应用内安装保留产物基础。
- Git tag 与 `package.json` 版本必须一致；只消费正式 Release。
- macOS 正式应用内更新的启用条件是 Developer ID Application 签名与 notarization，不能以 ad-hoc/self-signed 代替。

## 5. Error Handling

- **网络或 GitHub 不可达**：转为中文 `error` 状态，保留重试入口，不阻断启动。
- **元数据或产物缺失**：提示当前发布暂不支持应用内更新，并允许打开 Release 页面。
- **重复操作**：检查、下载和安装均有进行中守卫，重复点击不创建并发任务。
- **窗口重建**：更新服务保持 Main 单例，新窗口读取当前快照并重新订阅，不重复初始化更新器。
- **录制冲突**：录制期间不开始自动检查，不允许安装；绝不为更新主动停止录制。
- **macOS 未签名**：只提供 Release 跳转，界面不得暗示可在应用内安装。
- **下载失败**：保留已发现版本信息，显示重试；不得自动退出应用。
- **Release notes 异常或过长**：清洗为纯文本并截断展示，无内容时只显示版本号。
