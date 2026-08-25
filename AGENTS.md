# AGENTS.md — screen-recorder 项目规则

> Screen Studio 类录屏软件（Electron + React + TypeScript + electron-vite）。
> 唯一事实来源：`docs/TECH_DESIGN.md`；spec 索引：`sdd/project.md`。

## 常用命令

```bash
npm run dev         # 开发（先构建当前平台 window-geometry helper，再启动 electron-vite dev）
npm run build       # 构建
npm run build:native # 构建系统音频原生 helper + 字幕 whisper helper，并下载内置字幕模型（darwin→sck-audio Swift；win32→wasapi-audio Rust，按当前平台分发）
npm run dist         # 本地打包（electron-builder，配置在 electron-builder.yml，产物在 release/）
npm run typecheck   # 类型检查（node + web 两套 tsconfig，改动后必跑）
```

Release 流水线：`.github/workflows/release.yml`，打 tag `v*` 触发，macOS（dmg）+ Windows（NSIS）双平台构建并自动发布 GitHub Release；打包后原生 helper 经 electron-builder `extraResources` 放到 `resourcesPath` 根（与 `electron/capture/systemAudio/{darwin,win32}.ts` 的查找路径一一对应，改路径时三处需同步）。发版说明由 `scripts/release-notes.mjs` 按模板 `.github/RELEASE_TEMPLATE.md` 生成（从上一 tag 到当前 tag，按 commit 前缀分类：`feat`→新增、`fix/perf/revert`→修复、其余→其他），并在模板后追加 GitHub 自动变更清单。

## 架构分层与模块边界

```
┌─ Renderer (React)   src/        UI、预览播放、运镜渲染（预览/导出共用同一管线）
├─ Main (Node)        electron/   屏幕采集、全局输入监听、会话落盘、权限
└─ 共享契约           shared/     IPC 通道名与类型定义（两端共用的唯一来源）
```

核心设计原则：**录制与渲染分离**。录制期只采集原始画面 + 鼠标/键盘事件；运镜、光标美化等效果在预览/导出期基于 `events.json` 重新合成。

### `electron/` — Main 进程

| 目录 | 职责 | 规则 |
|---|---|---|
| `capture/` | 屏幕/音频采集（desktopCapturer 源枚举、ScreenCaptureKit / WASAPI 原生 helper 路径） | 采集语义变更必须同步更新 `docs/TECH_DESIGN.md` §3.1 |
| `input/` | 鼠标轨迹轮询（cursorPoller）、uiohook 全局事件 | 事件时间戳一律相对录制开始（ms），与视频帧对齐 |
| `store/` | 录制会话落盘 | `events.json` 格式是跨模块契约，改动需评估对 kr-02+ 的影响 |
| `preload/` | 桥接层 | 只暴露白名单 API，禁止透传 `ipcRenderer` 本体 |
| `permissions.ts` | macOS 权限引导 | |

### `src/` — Renderer

| 目录 | 职责 | 规则 |
|---|---|---|
| `components/` | UI 组件 | 通用基础组件放 `components/ui/`（shadcn/ui 约定） |
| `recorder/` | 录制逻辑（MediaRecorder、wav 落盘） | 不直接操作 DOM/UI，通过 store 交互 |
| `store/` | zustand 状态 | 跨组件共享状态才进 store，局部状态用 useState |
| `lib/` | 纯工具函数 | 无副作用、无依赖 UI 框架 |
| `types/` | Renderer 侧类型声明 | 跨进程共享的类型放 `shared/`，不放这里 |

### `shared/` — 跨进程契约

- IPC 通道名、请求/响应类型在此定义，Main 和 Renderer **只能从这里引用**，禁止各自重复定义。

## 代码组织硬性规则

### 1. 单文件行数上限：300 行

- 页面/组件文件**不得超过 300 行**。
- 超出时按职责拆分：
  - 状态逻辑、副作用、数据加工 → 抽成自定义 hook（放 `src/hooks/` 或就近的 `hooks.ts`）；
  - 可复用的 UI 片段 → 抽成公共组件（`src/components/`）；
  - 纯数据/格式转换 → 抽成 `src/lib/` 工具函数。
- 同约束适用于 `electron/` 下的模块文件。

### 2. 复用优先

- 写新功能前，先搜已有实现（hooks、组件、lib 工具）；**有相同/相近功能必须复用或扩展，禁止复制粘贴出新副本**。
- 第二次出现相似逻辑时，立即提取为公共实现，而不是等第三次。

### 2.1 shadcn/ui 组件必须通过 CLI 下载

- 使用 shadcn/ui 组件时，必须通过官方 CLI 下载，例如 `npx shadcn@latest add select`；禁止凭记忆自行编写或复制一个同名替代实现。
- 下载前先检查 `components.json` 与 `src/components/ui/`，已有组件应复用或在下载版本上做符合项目设计 token 的最小调整。
- CLI 生成的组件必须适配项目现有 CSS 变量、Tailwind token、TypeScript 和无障碍约定；不得为了保留默认 shadcn 配色破坏 Lenza 主题系统。

### 3. 分包 / 按模块聚合

- 同一功能领域的代码聚在同一个目录下（如 `input/`、`recorder/`），不要按"文件类型"平铺。
- 目录内文件超过 ~6 个时，按子领域再分一层子目录。
- 新增模块时先对照 `docs/TECH_DESIGN.md` §6 的规划结构（`timeline/`、`render/`、`export/` 等），归位到规划位置，不要随意新建顶层目录。

### 4. 最小改动

- 只改任务涉及的文件；不做顺手重构、改名、格式化等无关 churn。
- 新代码风格跟随所在文件的既有约定（命名、注释密度、结构），不引入新依赖前先确认 `package.json` 里没有现成方案。

### 5. 跨平台（macOS / Windows）拆分

项目目标是 macOS + Windows 双平台可用，平台差异代码必须显式拆分，禁止在一个文件里堆 `if (platform)` 大杂烩：

- **Main 进程**：平台相关实现拆成独立文件，按 `xxx/darwin.ts`、`xxx/win32.ts` 命名，外加一个 `xxx/index.ts` 做平台分发（只放分发逻辑，不写实现）。参考 `electron/capture/systemAudio/`。
- **Renderer 进程**：平台判断统一走 `window.api.platform`（preload 白名单暴露），禁止解析 `navigator.userAgent`；差异逻辑同样拆成平台文件或就近的小守卫，超过 ~10 行的平台分支必须抽文件。
- **平台无关的可复用逻辑**（格式转换、时间轴计算、协议解析等）必须抽离到共享模块（`src/lib/`、`shared/` 或功能目录下的平台无关文件），平台文件里只做平台 API 的调用与适配。
- 某平台暂未实现时：分发层返回 `null` / 降级，**静默不阻断主流程**，并在注释里标明各平台的实现位置。
- 新增平台相关功能时，`docs/TECH_DESIGN.md` 里要写明各平台的路径差异。

## 性能优化规则

播放渲染与时间轴是本项目的热路径（60fps），以下规则均为已验证的实践，新代码必须遵守：

### 1. 高频路径不走 React state

- 逐帧变化的内部值（动画积分器、上一帧时间戳、滚动位置）一律放 `useRef`；每帧只允许必要的 `setState`（如 `currentMs`）。
- 滚动位置（`scrollLeft`）等高频 DOM 状态直接读写 DOM，不要用 state 驱动滚动，避免每帧整树重渲染。

### 2. 帧驱动用 requestVideoFrameCallback，不自开 rAF

- 与视频播放相关的逐帧工作（合成绘制、播放头推进、视口跟随）挂 `video.requestVideoFrameCallback`，暂停/卸载时必须 `cancelVideoFrameCallback`，不允许留下空转的循环。
- 派生的逐帧效果（如时间轴跟随滚动）通过帧回调更新的 state（`currentMs`）间接触发，不另开 `requestAnimationFrame`。
- 一次性的 DOM 校正（缩放锚点保持）用 `useLayoutEffect`，不要写成持续动画循环。

### 3. 派生数据纯函数化 + 引用驱动更新

- 关键帧、运镜片段、裁剪换算等派生数据由纯函数（`src/timeline/`）计算，store 只持有引用；消费方靠"引用变化 → effect 重建"更新（见 usePlayback 的 animator 重建），禁止深比较或 JSON diff。
- 事件时间戳/时间轴换算只做一次归一化（`normalizeCuts` 等），热路径里不重复排序合并。

### 4. 渲染量按可见性降级

- 大数组 DOM 渲染（时间轴事件点、键帽）按密度降级（如键帽 → 圆点），不全量硬渲染。
- DOM 尺寸测量用 `ResizeObserver`；渲染路径里不读会触发强制同步布局的属性。

### 5. 重负载离开主线程 + 背压

- 导出/编码在 Worker 内逐帧驱动，`encodeQueueSize` 超上限必须挂起等待（背压），禁止一次性灌满编码器队列。
- PCM/WAV 处理走纯函数 +  typed-array 切片（`subarray`/`set`），不逐样本复制；音画换算共用同一份映射函数，避免双份逻辑漂移。

### 6. 手势与异步边界

- 异步 seek/跳转（裁剪跳过、探针 seek）必须有"进行中"守卫，完成前不触发新 seek，防止连续 seek 卡死（参见 usePlayback `skippingRef`/`probingRef`）。
- 手势区域注意 pointer capture 对 click 的吞噬：浮层按钮需要 `stopPropagation` 阻断父级手势。

## 测试与验证

- 目前无单元测试设施；改动后的最低验证是 `npm run typecheck` 通过 + 手动冒烟（录制 1 分钟，检查事件与视频时间轴对齐）。
- 涉及采集语义、events.json 格式、权限流程的改动，必须在 PR/提交说明里标注需要人工冒烟的平台项。

## 文档同步

- 改动架构、目录结构、采集/录制语义、数据格式时，同步更新 `docs/TECH_DESIGN.md`。
- 新增/变更 spec 时，同步更新 `sdd/project.md` 注册表。
- 本文件的规则如有调整（命令、目录、约定），直接更新本文件。
