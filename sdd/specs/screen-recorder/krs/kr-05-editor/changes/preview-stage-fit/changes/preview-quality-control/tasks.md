# Task Breakdown & Execution Board: 编辑预览清晰度与性能提醒

## Phase 1: 设置契约与纯逻辑

- [x] Task 1.1：新增 `PreviewQualityMode`，扩展 AppSettings V2 默认值、非法值回退、Main 更新白名单、preload/IPC 和 Renderer settings store。
- [x] Task 1.2：在 `stageFit` 中实现四档质量 profile 纯函数，并扩展 smoke 覆盖 DPR、分辨率上限、输出上限与非法输入。

## Phase 2: 清晰度选择与渲染接入

- [x] Task 2.1：在编辑布局控制区加入紧凑、可访问的清晰度 Select，绑定全局设置并为档位提供清晰标签。
- [x] Task 2.2：让普通编辑 `PreviewPlayer` 消费质量 profile；保持 64px 桶化、播放位置和 CSS 舞台尺寸，专注预览继续走原有独立规则。

## Phase 3: 性能监控与可操作 Toast

- [x] Task 3.1：实现无 React 逐帧 state 的 rVFC 性能监控器，覆盖 3 秒预热、2 秒窗口、70% 阈值以及暂停/seek/后台/专注状态重置。
- [x] Task 3.2：通过 shadcn CLI 添加 Sonner，在 App 根节点挂载顶部居中 Toaster，并接入稳定 id 的“切换到流畅 / 保持当前清晰度” warning Toast。
- [x] Task 3.3：按当前打开会话管理提醒抑制状态，确保切换会话后重置、同一会话不重复堆叠 Toast。

## Phase 4: 会话卡片与验证

- [x] Task 4.1：提高 SessionCard 时长徽标的不透明度、文字对比度、字号、内边距和边界层级；实现完成，待解锁后的深浅主题目视确认。
- [x] Task 4.2：同步 `docs/TECH_DESIGN.md`，运行 typecheck、变更文件 ESLint、build、stage/render/settings smoke 与 `git diff --check`。
- [x] Task 4.3：关闭四档切换、重启持久化、播放连续性、卡顿 Toast 操作、专注预览独立性和会话时长可读性的自动与代码验收。
  > 移交 kr-05 父级 checklist：macOS 与 Windows 完整实机回归。
- [x] Task 4.4：根据实机反馈移除缩略图时长浮层，将时长固定放入卡片正文的会话 ID 元数据行右侧。

# Task Dependencies

- [Task 1.2] depends on [Task 1.1]
- [Task 2.1] depends on [Task 1.1]
- [Task 2.2] depends on [Task 1.2] and [Task 2.1]
- [Task 3.1] depends on [Task 2.2]
- [Task 3.2] depends on [Task 1.1] and can run in parallel with [Task 2.1]
- [Task 3.3] depends on [Task 3.1] and [Task 3.2]
- [Task 4.1] can run in parallel with [Task 1.1] through [Task 3.3]
- [Task 4.2] depends on [Task 3.3] and [Task 4.1]
- [Task 4.3] depends on [Task 4.2]
- [Task 4.4] depends on [Task 4.1]
