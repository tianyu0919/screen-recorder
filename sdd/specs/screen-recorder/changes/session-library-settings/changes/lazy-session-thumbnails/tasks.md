# Task Breakdown & Execution Board: 会话库可视区懒加载与缩略图缓存

## Phase 1: 契约与缓存模块
- [x] Task 1.1: 在 `shared/` 增加缩略图信息与保存请求契约，并注册白名单 IPC
- [x] Task 1.2: 实现 Main 缩略图缓存模块：可信路径、源指纹、原子写入、读取校验与残留清理
- [x] Task 1.3: 扩展 `media://` 协议以只读方式提供受信 WebP 缓存

## Phase 2: 会话生命周期接入
- [x] Task 2.1: 会话列表附带有效缩略图 URL/时长，缓存无效时安全降级
- [x] Task 2.2: 永久删除、清空回收站和移除失效索引时清理缓存；移入/恢复保留缓存
- [x] Task 2.3: preload 与 Renderer 类型接入保存缩略图 IPC，保护 sessionId 和迟到结果

## Phase 3: 可视区与卡片媒体策略
- [x] Task 3.1: `SessionList` 实现首批挂载、底部哨兵预取和分类/刷新重置
- [x] Task 3.2: `SessionCard` 实现可视区探测、首帧 WebP 提取、时长缓存和失败回退
- [x] Task 3.3: 已缓存卡片常态使用图片，悬停延迟后临时挂载视频，移开后释放资源
- [x] Task 3.4: 保持日期分组、Motion 过渡、键盘操作、回收站倒计时和卡片反馈兼容
- [x] Task 3.5: 隐藏封面探测视频，增加图片/预览加载反馈，并保证图片与悬停视频无闪烁切换

## Phase 4: 验证与文档
- [x] Task 4.1: 增加缓存路径/指纹/生命周期和批次计算 smoke
- [x] Task 4.2: 运行 typecheck、源码 lint、build 及会话库/预览相关回归
- [x] Task 4.3: 关闭首屏请求量、滚动批次、回滚、悬停释放和跨启动缓存命中的自动与代码验收。
  > 移交 session-library-settings 父级：大量会话实机性能回归。
- [x] Task 4.4: 更新 `docs/TECH_DESIGN.md` 的会话库加载、缓存目录、协议与清理语义

# Task Dependencies
- [Task 1.2] and [Task 1.3] depend on [Task 1.1]
- [Task 2.1] and [Task 2.2] depend on [Task 1.2]
- [Task 2.3] depends on [Task 1.1]
- [Task 3.1] can run in parallel with [Task 1.x] and [Task 2.x]
- [Task 3.2] depends on [Task 2.1] and [Task 2.3]
- [Task 3.3] and [Task 3.4] depend on [Task 3.2]
- [Task 4.x] depends on [Task 1.x] through [Task 3.x]
