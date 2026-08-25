# Verification Checklist: 录像显示名称与内联重命名

## Functional Verification
- [x] 双击详情页名称进入编辑并自动全选；Enter 和失焦保存，Escape 取消
- [ ] 空值、超长、非法字符、尾随句点和 Windows 保留名均不保存并显示就地错误
- [ ] 保存后详情页与全部录像卡片立即显示新名称，重启和刷新后仍保留
- [ ] 旧会话无显示名称时继续显示 `sessionId`
- [ ] 重命名不改变 `sessionId`、会话目录、媒体 URL、缩略图和字幕/编辑数据
- [ ] 后续 MP4/WebM/SRT 默认使用新名称，同名产物追加 `(n)` 且不覆盖

## Code Quality
- [x] IPC 通道与类型只定义在 `shared/`，preload 仅暴露白名单方法
- [x] Main 与 Renderer 共用同一名称校验，不解析 user agent
- [x] 新增/修改文件均不超过 300 行，无调试日志和无关重构
- [x] 无新增 TypeScript 或 ESLint 错误

## Testing
- [ ] 名称校验和 SessionCatalog 持久化 smoke 通过
- [x] `npm run typecheck` 与 `npm run build` 通过
- [x] macOS 人工冒烟通过（2026-08-25 用户确认）
- [ ] Windows 人工冒烟通过

## Non-Functional
- [x] 输入框、错误提示和编辑态在窄窗口不挤压工具栏
- [x] 双击、键盘、失焦和焦点反馈符合桌面可访问交互
- [x] 重命名不触发视频解码、缩略图重建或会话目录移动
