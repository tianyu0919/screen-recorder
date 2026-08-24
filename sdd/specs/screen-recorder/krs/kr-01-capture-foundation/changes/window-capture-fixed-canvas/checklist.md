# Verification Checklist: 窗口录制固定画布与动态几何

## Functional Verification

- [ ] macOS 与 Windows 的窗口录制采用开始时所在显示器物理分辨率作为固定画布。
- [ ] 小窗口开始后移动、缩放、最大化和还原，screen.webm 分辨率全程不变且内容不拉伸、不裁切。
- [ ] 窗口跨不同 DPI/分辨率显示器移动后，固定画布不变且内容 placement 正确。
- [ ] 点击波纹在所有几何变化前后落在实际点击区域。
- [ ] 自动运镜、鼠标跟随和波纹对同一事件使用一致坐标；窗口外点击被过滤。
- [ ] 最小化、零尺寸和短时 geometry 缺失不产生 NaN、崩溃或无限帧队列。
- [ ] 来源关闭复用现有中文错误和安全停止流程。

## Compatibility & Determinism

- [x] V1 会话无需迁移即可预览和导出，原 events.json 不被修改（自动 smoke）。
- [ ] V2 会话重新打开后 fixedCanvas、geometry、波纹和运镜不漂移。
- [ ] 预览与 MP4 导出抽查至少 5 个 resize/移动时间点，画面与交互效果一致。
- [ ] 整屏录制的分辨率、坐标、系统音频和导出行为无回归。

## Performance & Resources

- [ ] 2K60 窗口录制 1 分钟无明显掉帧，Renderer 交互不卡死。
- [ ] Worker 实施背压，VideoFrame、生成轨、输入轨和 Worker 在停止/异常时全部释放。
- [x] geometry 静止样本去重并在变化前补保持点（纯函数与协议 smoke）。

## Build & Code Quality

- [x] macOS Swift 与 Windows Rust helper 可由 `npm run build:native` 在对应平台构建（v0.3.8 Release 双平台 CI 通过）。
- [x] electron-builder 与 release workflow 将对应 helper 放入运行时查找路径。
- [x] 平台实现拆分为 darwin/win32，分发层不包含平台业务实现。
- [x] 所有受影响文件不超过 300 行，跨模块契约只在 `shared/` 定义。
- [x] Windows 上 `npm run typecheck`、完整 lint、`npm run build`、native build 与相关 smoke 全部通过。
- [x] `docs/TECH_DESIGN.md`、SDD 注册表和采集语义同步完成。

## Manual Smoke

- [ ] macOS：窗口移动、缩放、最大化、还原、跨屏、最小化、关闭及点击位置通过。
- [x] Windows：窗口移动、缩放、最大化、还原、跨屏、最小化、关闭及点击位置通过（2026-08-25 实机确认；导出文件为恒定 2560×1440、60fps）。
- [ ] 2K 显示器导出原始 2560×1440 与降档 1920×1080 均可播放且效果一致。
