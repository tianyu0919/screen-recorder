# Task Breakdown & Execution Board: Lenza 现代浅色界面与动效升级

## Phase 1: 基线审计与设计基础

- [x] Task 1.1：记录当前工作树与三视图基线，逐项映射现有组件、store、IPC 和导出入口，确认无业务逻辑替换。
- [x] Task 1.2：审计 `package.json` 与 lockfile；已安装 `motion` 并提供现有 TypeScript/React 栈的 lint 脚本。
- [x] Task 1.3：重构全局 light/dark 语义 token、字体、阴影、圆角、focus-visible 与 reduced-motion 规则；浅色设为首次启动默认值，保留 system/light/dark 偏好切换。
- [x] Task 1.4：更新页面 metadata 与根布局主题色，保持 CSP 和 Electron 加载路径不变。

## Phase 2: 共用外壳与 Motion 基础

- [x] Task 2.1：抽取或整理 Header、PermissionStatus、视图容器等共用展示组件，复用 AppLogo、Segmented、ThemeSwitch 和 WindowControls。
- [x] Task 2.2：为页面切换接入 `AnimatePresence`，建立统一的容器/列表 stagger、button tap、card hover 变体及 `useReducedMotion` 降级策略。
- [x] Task 2.3：审计并统一 Button、Switch、Slider、checkbox/选中标识、Chip 的 hover、active、disabled、focus-visible 和 aria 状态。

## Phase 3: 录制准备页

- [x] Task 3.1：将录制页组织为 Header、PermissionStatus、SourceSelector、WindowCard、RecordingDock 等职责清晰的组件，单文件不超过 300 行。
- [x] Task 3.2：重塑屏幕/窗口真实采集源网格、缩略图、名称和选中状态；保留刷新、空状态、错误和 `appStore` 选源逻辑。
- [x] Task 3.3：重塑底部固定录制控制栏，连接既有麦克风、系统音频、录制/停止、计时、错误和上次录制入口。
- [x] Task 3.4：加入分组淡入、卡片 stagger、录制按钮 box-shadow 呼吸、hover/tap/recording 状态动效，并验证 reduced-motion。

## Phase 4: 录制历史页

- [x] Task 4.1：将会话列表整理为 RecordingHistory 与 SessionCard 组合，保留真实分组、刷新、加载、空状态、错误和视频缩略图行为。
- [x] Task 4.2：完善会话数量、今天/昨天等分组、时长与录制 ID 呈现；hover/focus 时上移 4px 并显示操作反馈，支持键盘打开。
- [x] Task 4.3：为分组和网格接入 stagger 动画，并确认不会因动画或 effect 产生额外 `loadSessions` 请求。

## Phase 5: 预览编辑页

- [x] Task 5.1：整理编辑器顶部栏，展示返回、日期、ID、时长、分辨率、FPS、适应/100%、文件位置和真实导出状态。
- [x] Task 5.2：重塑 PreviewCanvas 深色画布与舞台容器，复用 WebGL canvas、视频/音频同步、适应/100% 与错误降级逻辑。
- [x] Task 5.3：整理可折叠 SettingsPanel，完整呈现运动全局参数、目标倍率、停留时长、回归阈值、分轨音量、裁剪说明和会话信息；滑杆实时连接现有 store。
- [x] Task 5.4：重塑底部 Timeline 的播放控制、当前/总时长、刻度、运动片段、键盘事件和音频轨，保留 seek、缩放、平移、裁剪与帧驱动热路径。
- [x] Task 5.5：完善导出 loading/progress、成功、失败与取消反馈，不改动导出 pipeline；为编辑器进入/返回增加克制过渡。

## Phase 6: 响应式、无障碍与回归

- [ ] Task 6.1：在 1280×800 与 1440×900 验证三视图；较小窗口可折叠设置面板，时间轴保持底部，修复明显溢出与遮挡。
- [ ] Task 6.2：完成中文文案、图标、aria-label/aria 状态、键盘操作、焦点顺序、对比度和 reduced-motion 审计。
- [ ] Task 6.3：搜索并清理受影响 UI 中的 `text-white`、`bg-white`、`bg-black`、直接品牌色、紫色渐变与无意义装饰；合理的深色视频画布也必须由 token 表达。
- [x] Task 6.4：运行 lint、`npm run typecheck`、`npm run build`，修复全部编译错误和 lint 问题。
- [x] Task 6.5：使用浏览器或 Electron 完成录制页、历史页、编辑页视觉冒烟，并验证视图切换、录制、播放、滑杆、开关、主题与导出反馈。
- [ ] Task 6.6：执行至少 1 分钟真实录制回归，检查事件/视频时间轴对齐及会话进入预览；记录 Windows 实测结果与 macOS 待人工项。
- [ ] Task 6.7：复核所有受影响文件与 `checklist.md`，同步必要的 `docs/TECH_DESIGN.md` 视觉/目录说明并更新 SDD 状态。

# Task Dependencies

- [Task 1.2]、[Task 1.3] 和 [Task 1.4] 依赖 [Task 1.1]。
- [Task 2.1]、[Task 2.2] 和 [Task 2.3] 依赖 [Task 1.2] 与 [Task 1.3]；三者可并行。
- [Task 3.1–3.4]、[Task 4.1–4.3]、[Task 5.1–5.5] 依赖 Phase 2；录制页、历史页、预览编辑页三组可并行。
- [Task 3.4] 依赖 [Task 3.1–3.3]；[Task 4.3] 依赖 [Task 4.1–4.2]；[Task 5.5] 依赖 [Task 5.1–5.4]。
- [Task 6.1–6.3] 依赖 Phase 3–5 完成；三项可并行。
- [Task 6.4–6.7] 依次执行，并依赖 [Task 6.1–6.3]。
