# Proposal: screen-recorder（Screen Studio 类录屏软件） (Proposal)

## 1. Context & Problem Statement
- **Current State**: 项目为全新空仓库，仅有 `docs/TECH_DESIGN.md`（已定稿的技术方案）与 `.gitignore`，尚无任何代码。目标产品是 macOS / Windows 跨平台桌面录屏工具，对标 Screen Studio。
- **Pain Points**:
  - 传统录屏工具录出来的是"平铺直叙"的原始画面，观众难以聚焦操作重点；手动剪辑缩放运镜的成本极高。
  - 系统光标被烧录进画面后无法后期美化（放大、平滑、换肤）。
  - Screen Studio 仅支持 macOS，Windows 用户无同类产品。
- **核心洞察（来自 TECH_DESIGN.md）**：所有视觉效果（自动缩放运镜、光标美化、点击高亮、按键回显、画中画）本质上都是"数据驱动的时间线渲染"。因此录制期只需低成本地采集原始画面 + 鼠标/键盘事件流，渲染与运镜全部推迟到预览/导出阶段完成。

## 2. Value Proposition
- 用户录制完即可自动获得带缩放运镜、点击聚焦效果的演示视频，无需任何手动剪辑。
- 降低演示视频制作成本：一次录制，多次以不同运镜参数导出。
- 跨平台（macOS + Windows），覆盖 Screen Studio 未覆盖的 Windows 市场。
- 录制与渲染分离的架构保证录制期 CPU 占用低、导出输出帧率恒定（60fps，不受机器性能影响）。

## 3. Alternatives Considered
- **Option A: Electron + React + TypeScript（electron-vite）** — 选定方案。跨平台一套代码、WebCodecs/WebGL 可用、生态成熟。代价：屏幕采集默认把系统光标烧录进画面且无官方开关；macOS 拿不到系统声音。缓解措施：MVP 接受光标烧录（方案 A），架构上预留 `captureCursor: boolean` 抽象，后续用原生采集 helper（macOS ScreenCaptureKit `showsCursor=false` / Windows WGC `IsCursorCaptureEnabled=false`）彻底解决。
- **Option B: 全原生开发（Swift + Win32 双端）** — 采集能力最完整（无光标采集、系统声音均无限制），但需维护两套代码库，研发成本翻倍，UI/编辑器难以复用。（Cons: 成本过高，违背快速验证 MVP 的目标）
- **Option C: Tauri + Rust** — 包体小、性能好，但屏幕/输入采集层仍需手写平台原生代码，WebCodecs 在 Tauri 的 WebView（尤其 macOS WKWebView）上支持不确定，风险高于 Electron（Chromium 内核，WebCodecs 明确可用）。（Cons: 核心依赖 WebCodecs 的可用性无法保证）
- **Option D: 录制时把系统光标设为透明（NSCursor.hide 类 hack）** — 不稳定、平台差异大，明确不推荐。

## 4. Success Metrics
- [ ] 录制 → 自动运镜预览 → 导出 mp4 的端到端闭环跑通，核心流程无阻断性 bug
- [ ] 录 1 分钟，鼠标/键盘事件与视频时间轴对齐误差 < 50ms
- [ ] 导出 1080p60 mp4，画面内容与预览一致，输出帧率恒定
- [ ] 点击处自动缩放运镜，spring 动画平滑无生硬跳变
- [ ] 光标可放大/换肤，轨迹平滑（M4，依赖原生采集 helper）
- [ ] macOS 与 Windows 双平台冒烟通过（含权限引导：屏幕录制 + 辅助功能）
