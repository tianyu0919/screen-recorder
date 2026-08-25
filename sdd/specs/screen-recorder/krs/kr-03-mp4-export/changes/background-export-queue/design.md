# Design: 后台导出队列与默认导出目录

## Architecture

Renderer 的应用级 Export Store 持有 `activeTask + queuedTasks + recentResults`。每个任务在点击时捕获完整 `ExportStartMessage`，队列调度器只允许一个 Worker 活跃；详情页卸载不再 reset Store。

Worker 完成后通过白名单 IPC 把 buffer 写入任务指定目录。Main 负责目录校验、递增文件名和排他创建，避免检查后写入的竞态。自动导出使用 `AppSettings.exportPath`，临时导出只携带当前目录。

全局 `ExportActivityToast` 挂在应用根节点，不依赖详情页。Toast 展开/收缩只消费低频 progress state，不进入逐帧渲染路径。

## Data

- `AppSettings.version` 迁移并新增 `exportPath`，默认 `Videos/Lenza/Exports`。
- `ExportTask` 保存 taskId、sessionId、显示名、目标模式、冻结消息、状态、进度和结果。
- 任务仅驻留内存；应用重启不恢复队列。

## Cancellation and Exit

- 取消活跃任务终止 Worker，随后调度下一任务。
- 取消等待任务只从队列移除。
- 返回页面、切换会话、窗口后台不触发取消。
- app quit 前由 Main 向 Renderer 查询/接收导出忙碌状态；用户确认后终止。
