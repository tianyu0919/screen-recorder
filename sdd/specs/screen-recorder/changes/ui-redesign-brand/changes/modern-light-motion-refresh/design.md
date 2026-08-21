# Design: Lenza 现代浅色界面与动效升级

## 1. 架构

本变更位于 Renderer 表现层。`src/store/`、`src/recorder/`、`src/timeline/`、`src/render/`、`src/export/` 与 `shared/` 保持业务事实来源；页面组件只订阅并呈现既有状态。

```text
App（品牌外壳、主题、视图过渡）
├─ RecordView
│  ├─ Header / PermissionStatus
│  ├─ SourceSelector / WindowCard
│  └─ RecordingDock
└─ PreviewView
   ├─ RecordingHistory / SessionCard
   └─ EditorView
      ├─ PreviewCanvas
      ├─ SettingsPanel
      └─ Timeline

既有 Zustand stores / Electron preload API / IPC / 渲染与导出管线
```

- 复用现有 `AppLogo`、图标集合、Button、Switch、Slider、Segmented、Chip 及业务组件；只有复杂展示区域需要按职责进一步拆分。
- 若依赖中不存在 Motion，则安装 `motion` 并统一从 `motion/react` 导入；页面切换由 `AnimatePresence` 管理，列表由父容器 variants 控制 stagger。
- 动画优先使用 transform 与 opacity，避免影响布局的高频动画；视频播放仍只使用既有 `requestVideoFrameCallback` 路径。

## 2. 主题与设计 token

- `src/index.css` 定义 light/dark 两套语义变量，`tailwind.config.js` 只映射语义名称；组件不得新增 `bg-white`、`bg-black`、`text-white` 等直接色值类。
- 色彩限制为中性背景/表面、文字/边框、橙红强调、成功、警告/错误状态等必要语义组；不使用紫色渐变或装饰性渐变光球。
- 浅色为无已保存偏好时的默认主题；保留 `system | light | dark` 切换和既有偏好持久化，不用 localStorage 承载任何业务数据。
- 字体最多两种：Geist（仅在项目已有本地/依赖资源时使用）或系统无衬线字体；时间码可使用系统等宽字体栈。

## 3. 数据流与交互

1. 用户切换录制/预览，`appStore.view` 仍是唯一视图状态，`AnimatePresence` 只包装内容层。
2. 采集源、权限、录制开关和录制按钮继续调用 `appStore` 既有 action；Motion 根据 `status` 呈现 idle/recording/stopping 反馈。
3. 会话历史继续由 `previewStore.loadSessions/openSession` 提供，分组逻辑和真实视频缩略图不改为演示数据。
4. 预览播放、seek、滑杆、折叠检查器和导出继续调用既有 hook/store；新增反馈只消费真实 `playing`、参数值与 export status。
5. `useReducedMotion` 与 CSS `@media (prefers-reduced-motion: reduce)` 双重约束 JS/CSS 动画。

## 4. 响应式与无障碍

- 以 1440×900 为完整布局，1280×800 保持全部核心操作；较窄窗口允许设置面板折叠，时间轴固定在编辑区底部。
- 使用 flex/grid 和 `min-w-0`/`min-h-0` 控制布局，不以大量 absolute 拼页面；absolute 仅用于角标、播放头等局部叠层。
- 所有图标按钮、checkbox、开关、滑杆提供中文可访问名称、键盘操作和可见 `focus-visible` 样式。
- hover 不是唯一反馈；选中、录制中、导出中/成功/失败均有文字或图形状态。

## 5. 错误与降级

- 采集源为空、权限未授权、会话加载失败、视频不可解码和导出失败继续显示现有友好错误，不吞掉 store 错误。
- Motion 加载失败不得影响业务状态；减弱动态模式直接渲染最终状态。
- 小窗口中优先折叠设置面板和降低非关键信息密度，不隐藏录制、播放、时间轴或导出主操作。
- 某平台无法在当前环境人工验证时，在 checklist 保留未勾选的平台项，不以浏览器 mock 代替 Electron IPC 验证。
