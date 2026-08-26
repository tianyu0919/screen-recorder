# Task Breakdown & Execution Board: VFR 录屏流畅预览

## Phase 1: 渲染职责拆分

- [x] Task 1.1：为合成器拆分视频纹理上传与复用最近纹理合成接口，同时保持导出 `drawFrame` 兼容。

## Phase 2: 预览循环

- [x] Task 2.1：以 rVFC 上传新视频帧，以 rAF 连续推进媒体时间、相机和叠加层。
- [x] Task 2.2：保留裁剪跳过、片尾停止、seek、播放状态恢复及双循环清理。

## Phase 3: 文档与验证

- [x] Task 3.1：同步技术设计和项目性能规则中的 VFR 例外。
- [x] Task 3.2：运行 typecheck、ESLint、build 与 diff 检查。
- [x] Task 3.3：使用低帧率真实会话冒烟播放、点击跳转、按住拖动、暂停和裁剪跳过。

# Task Dependencies

- [Task 2.1] depends on [Task 1.1]
- [Task 2.2] depends on [Task 2.1]
- [Task 3.1] can run in parallel with [Task 2.1]
- [Task 3.2] depends on [Task 2.2] and [Task 3.1]
- [Task 3.3] depends on [Task 3.2]
