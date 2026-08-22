# Design: 会话库、回收站与应用设置

## 1. Architecture

- Main 进程新增设置仓储与会话目录索引，文件放在 `app.getPath('userData')` 的 Lenza 私有子目录。
- `settings.json` 保存版本化应用偏好；独立 `session-index.json` 保存会话位置、状态和回收站元数据。
- 新录制根目录默认为 `join(app.getPath('videos'), 'Lenza')`。历史 `userData/recordings` 首次启动时登记为旧根目录，不搬迁。
- Renderer 仅通过 `shared/` 白名单 IPC 操作设置和会话，不直接访问文件系统。
- Windows 后台关闭实现独立托盘适配；macOS 实现隐藏窗口并保留 Dock。平台分发层不承载业务实现。
- 平台无关的设置 schema、索引状态机、倒计时和路径边界校验保持共享；超过约 10 行的平台差异分别放入 `win32.ts`、`darwin.ts`，由薄 `index.ts` 分发。
- Windows 删除/移动前需处理 Chromium 媒体句柄占用；macOS 需覆盖 `activate`、窗口隐藏与 Dock 生命周期。Linux 本 change 不作为交付平台。

## 2. Data Model & Interfaces

```typescript
type ThemeMode = 'system' | 'light' | 'dark'
type CloseBehavior = 'background' | 'quit'
type TrashRetentionDays = 1 | 3 | 7 | 30 | null
type SessionAvailability = 'available' | 'storage-unavailable' | 'source-missing'
type SessionLifecycle = 'active' | 'trashed'

interface AppSettingsV1 {
  version: 1
  theme: ThemeMode
  recordingsPath: string
  recordingRoots: string[]
  trashRetentionDays: TrashRetentionDays
  closeBehavior: CloseBehavior | null // null 表示尚未选择“不再提示”
}

interface SessionIndexEntryV1 {
  sessionId: string
  rootPath: string
  relativePath: string
  lifecycle: SessionLifecycle
  availability: SessionAvailability
  trashedAt?: number
  purgeAt?: number
  originalRootPath?: string
  originalRelativePath?: string
}
```

- 配置读取执行 schema 校验、默认值合并和版本迁移；写入采用临时文件后原子替换。
- 会话目录解析必须校验规范化后的绝对路径仍位于已登记根目录或内部回收站根目录下。
- `RecordingSession` 扩展生命周期、可用性和清理时间字段；新增设置读取/更新、选择/打开目录、移入回收站、恢复、永久删除、移除失效索引等 IPC。

## 3. Data Flow & Interaction

1. 启动时加载/迁移设置，登记默认目录和旧目录，刷新会话索引并执行到期清理。
2. 新录制由 `SessionStore` 从设置仓储读取当前根目录并创建会话。
3. 历史页合并索引中的所有根目录，区分可用、存储离线和源文件已移除。
4. 普通删除将完整会话目录移动至 Lenza 内部回收站，并记录原位置、`trashedAt` 与 `purgeAt`。
5. 恢复时优先返回原位置；原根目录不可用或目标冲突时返回可处理错误，不覆盖现有文件。
6. Main 在启动时和运行期间定时清理到期项目；Renderer 以 `purgeAt - Date.now()` 展示倒计时。
7. 窗口关闭请求由 Main 根据持久化策略执行；策略为空时通知 Renderer 显示确认弹窗。

## 4. Error Handling

- **配置损坏**：备份损坏文件，回退安全默认值并保留可识别字段。
- **存储根离线/无权限**：保留索引并标记 `storage-unavailable`，不推断文件已删除。
- **根可访问但会话目录缺失**：标记 `source-missing`，只允许移除索引。
- **移动/恢复失败**：保持原生命周期状态，不提前更新索引，显示友好错误。
- **清理失败**：保留文件和条目，标记失败并允许重试；不得无限高频重试。
- **应用正在录制/导出**：禁止删除相关会话；关闭退出沿用既有安全停止约束。
- **Windows 文件占用**：先关闭卡片预览和当前媒体资源；失败则保持索引与文件原位。
- **macOS 窗口生命周期**：Dock 激活只恢复或创建单一主窗口，不重复注册 IPC/协议。
