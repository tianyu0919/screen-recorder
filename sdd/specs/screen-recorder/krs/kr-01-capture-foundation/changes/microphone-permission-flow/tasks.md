# Task Breakdown & Execution Board: 麦克风权限与可选录制流程

## Phase 1: 权限契约与 Main 流程

- [x] Task 1.1: 在 `shared/` 与 preload 白名单增加显式的麦克风申请 API，复用 `electron/permissions.ts`，返回申请后的真实权限状态。
- [x] Task 1.2: 移除写入 `mic.wav` 时的延迟授权，将写入流程改为只处理已经采集成功的音频数据。

## Phase 2: Renderer 状态与交互

- [x] Task 2.1: 让 `appStore.withMic` 与权限状态同步：非 `granted` 默认关闭，权限撤销后自动关闭。
- [x] Task 2.2: 实现麦克风开关授权流程：`unknown` 时主动申请，`denied` 时提供说明并打开系统麦克风设置，成功后刷新并打开。
- [x] Task 2.3: 调整权限引导和顶部状态，使仅麦克风缺失时仍有独立入口，同时明确麦克风可选且不阻断录制。

## Phase 3: 录制降级与反馈

- [x] Task 3.1: 开始录制前按最新权限决定是否采集麦克风；采集失败时给出中文提示并降级为无麦克风录制。
- [x] Task 3.2: 确保关闭麦克风后开始录制不触发任何麦克风授权请求，停止录制时也不补发请求。

## Phase 4: 验证与文档

- [x] Task 4.1: 补充 `unknown`、`denied`、`granted`、运行期撤权及采集失败的状态回归，并运行 `npm run typecheck`、`npm run build`。
- [ ] Task 4.2: 在 macOS 实机验证首次授权、拒绝后设置跳转、重新检查、授权撤销和无麦克风录制；同步 `docs/TECH_DESIGN.md`。

# Task Dependencies

- [Task 1.2] depends on [Task 1.1].
- [Task 2.1] and [Task 2.3] can run in parallel after [Task 1.1].
- [Task 2.2] depends on [Task 1.1] and [Task 2.1].
- [Task 3.1] depends on [Task 2.1] and [Task 2.2].
- [Task 3.2] depends on [Task 1.2] and [Task 3.1].
- [Task 4.1] depends on [Task 1.1] through [Task 3.2].
- [Task 4.2] depends on [Task 4.1].
