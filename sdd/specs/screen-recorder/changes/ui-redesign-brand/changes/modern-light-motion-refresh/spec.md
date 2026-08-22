---
id: "ui-modern-light-motion-refresh"
kind: change
parent: "ui-redesign-brand"
status: in_progress
impact_radius:
  - "src/App.tsx"
  - "src/index.css"
  - "src/index.html"
  - "src/components/"
  - "src/store/themeStore.ts"
  - "tailwind.config.js"
  - "package.json"
dependencies:
  - "ui-redesign-brand"
  - "kr-01-capture-foundation"
  - "kr-02-motion-playback"
  - "kr-03-mp4-export"
  - "kr-05-editor"
---

# Specification: Lenza 现代浅色界面与动效升级

## 1. 范围

- **范围内**：复用当前真实录制、会话、预览、编辑和导出功能，重构三个主要视图的视觉层、组件边界、交互反馈、主题 token、响应式、无障碍和克制动效；保留主题切换，浅色为默认与主要验收主题。
- **范围外**：采集/录制语义、IPC 与 preload 契约、`events.json`/`edit.json` 数据格式、WebGL 合成、时间轴计算、音频同步、导出编码逻辑、窗口控制语义和新增业务统计。

## 2. Functional Requirements

### ADDED

#### Requirement: 统一的现代桌面视觉体系
系统 SHALL 使用浅灰背景、橙红主色、柔和圆角、细边框与轻阴影形成 Lenza 视觉体系，并通过语义化设计 token 同时支持浅色、深色和跟随系统主题；浅色 SHALL 是无已保存偏好时的默认主题及主要验收主题。

##### Scenario: 首次启动
- **WHEN** 用户没有保存过主题偏好
- **THEN** 应用以浅色主题展示，且可切换到深色或跟随系统

##### Scenario: 主题切换
- **WHEN** 用户在任一主要视图切换主题
- **THEN** 当前视图立即使用对应 token 更新，核心控件、焦点态、错误态和深色画布保持可辨识

#### Requirement: 录制准备页
系统 SHALL 展示 Lenza Logo、产品名、描述“录制时采集数据，导出时自动运算”、录制/预览切换、三项权限状态、按屏幕和窗口分组的真实采集源、明显选中态，以及固定底部录制控制栏。

##### Scenario: 选择采集源
- **WHEN** 用户点击屏幕或窗口卡片
- **THEN** 既有采集源选择 action 被调用，选中项以橙红描边、checkbox/选中标识和可访问状态呈现

##### Scenario: 控制录制
- **WHEN** 用户切换麦克风或点击录制/停止按钮
- **THEN** 继续使用既有录制状态机；录制按钮在空闲时轻微呼吸、hover 放大、按下缩小，录制中显示停止形态、计时和文字状态

##### Scenario: 查看上次录制
- **WHEN** 存在上次录制且用户点击“进入预览”
- **THEN** 打开该真实会话的预览编辑页

#### Requirement: 预览编辑页
系统 SHALL 提供返回、日期、录制 ID、时长、分辨率、FPS、适应/100%、打开文件位置与导出操作；中央为深色圆角视频画布，右侧为可折叠设置面板，底部始终为可操作时间轴。

##### Scenario: 播放与时间轴
- **WHEN** 用户点击播放、暂停或时间轴位置
- **THEN** 既有播放器更新真实播放状态、当前时间和进度，运动片段、键盘事件和音频轨道保持可见可用

##### Scenario: 调整设置
- **WHEN** 用户拖动目标倍率、停留时长、回归阈值、麦克风音量或系统音频音量滑杆
- **THEN** 对应现有 store 值实时更新，并显示最新中文数值和清晰焦点状态

##### Scenario: 导出反馈
- **WHEN** 用户点击“导出 MP4”
- **THEN** 按钮或紧邻区域展示真实导出进度/loading；成功后展示明确成功反馈，失败或取消时保留既有可恢复路径

##### Scenario: 较小窗口
- **WHEN** 窗口接近项目最小尺寸或 1280×800
- **THEN** 设置面板可折叠释放舞台空间，时间轴仍固定在底部，关键工具栏操作无横向溢出

#### Requirement: 录制历史页
系统 SHALL 以“录制会话”和真实数量为标题，提供刷新操作，按今天、昨天等日期分组，以卡片网格展示真实视频缩略图、时长和录制 ID。

##### Scenario: 浏览与打开会话
- **WHEN** 用户悬停或聚焦会话卡片
- **THEN** 卡片轻微上移并显示可操作反馈；点击或按键激活后打开对应真实预览会话

##### Scenario: 加载与空状态
- **WHEN** 会话正在加载、为空或加载失败
- **THEN** 页面显示中文加载、空状态或友好错误，不触发无意义的重复数据请求

#### Requirement: 克制且可降级的 Motion
系统 SHALL 在依赖缺失时安装 `motion` 并从 `motion/react` 使用 `AnimatePresence`、staggerChildren、hover/tap scale 与录制按钮循环 box-shadow；所有动效 SHALL 尊重 `prefers-reduced-motion`。

##### Scenario: 正常动态偏好
- **WHEN** 用户进入页面、切换视图或浏览卡片网格
- **THEN** 内容分组淡入，卡片依次出现，视图以平滑淡入淡出或短距离滑动切换，卡片 hover 使用等效于 `y: -4` 的位移

##### Scenario: 减弱动态偏好
- **WHEN** 操作系统启用 `prefers-reduced-motion: reduce`
- **THEN** 循环呼吸和 stagger 被关闭，页面直接或以极短透明度过渡到最终状态，业务交互不受影响

#### Requirement: 中文、图标与无障碍
系统 SHALL 保持品牌名 Lenza 为英文，其余界面文字使用中文；优先复用现有图标库，不使用 emoji；按钮、滑杆、checkbox、开关和卡片 SHALL 支持键盘操作、可见焦点和必要的 `aria-label`/状态属性。

##### Scenario: 键盘导航
- **WHEN** 用户仅使用键盘遍历主要视图
- **THEN** 焦点顺序合理、焦点轮廓清晰，录制、播放、切换、调参、刷新、打开会话和导出均可操作

### MODIFIED

#### Requirement: 深色设计体系
原 `ui-redesign-brand` 的“深色设计体系”修改为“浅色优先的双主题设计体系”：保留深色主题，但不得再以深色作为唯一或默认视觉基准；两套主题均从同一语义 token 派生，清理组件中的直接白/黑/品牌色和装饰性渐变硬编码。

##### Scenario: 新增或改造组件
- **WHEN** 开发者新增或改造界面元素
- **THEN** 复用现有 UI 组件与 token，颜色总量保持克制，不引入紫色渐变、emoji 或第二套无关视觉体系

#### Requirement: 预览编辑器布局
原三段布局继续保留，并补充顶部元数据与操作层级、深色画布、可折叠设置面板、底部固定时间轴，以及 1280×800/1440×900 桌面尺寸验收。

##### Scenario: 视图切换
- **WHEN** 用户在录制与预览之间切换，或从历史进入编辑器再返回
- **THEN** 使用 AnimatePresence 平滑过渡，既有会话和录制状态不因纯展示组件重挂载而错误重置
