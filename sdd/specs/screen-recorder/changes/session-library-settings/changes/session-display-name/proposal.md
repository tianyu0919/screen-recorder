# Proposal: 录像显示名称与内联重命名 (Proposal)

## 1. Context & Problem Statement
- **Current State**: 详情页和“全部录像”卡片只展示机器生成的 `sessionId`，导出 MP4/SRT 也以该 ID 命名。
- **Pain Points**: 用户无法用有意义的名称整理录像；详情页、列表和导出文件之间缺少一致的人类可读标识。

## 2. Value Proposition
- 允许用户在详情页快速命名录像，并在列表与导出链路中保持一致。
- 保留稳定 `sessionId`，避免重命名磁盘目录导致媒体 URL、字幕任务、缓存和编辑引用失效。

## 3. Alternatives Considered
- **直接重命名会话目录与 sessionId**：会破坏索引、缓存、媒体协议和后台任务引用，跨卷移动还存在失败与回滚风险。
- **只在 Renderer 临时改名**：重启后丢失，且 Main 导出文件名无法可靠复用。
- **选定方案：索引持久化 displayName**：`sessionId` 保持不可变，显示名称进入会话索引并通过 IPC 更新。

## 4. Success Metrics
- [ ] 双击详情页名称可完成重命名，重启应用后仍保留。
- [ ] 详情页、全部录像列表、MP4 与 SRT 默认文件名一致使用显示名称。
- [ ] 旧会话无 `displayName` 时无迁移阻断，继续回退显示 `sessionId`。
