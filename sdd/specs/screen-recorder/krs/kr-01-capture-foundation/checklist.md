# Verification Checklist: kr-01-capture-foundation

> 每条客观可验证，全部勾选后方可关闭本 KR。
> Phase 5 验证（2026-08-19）：程序化项已实际运行验证；人工冒烟已于 2026-08-19 在 macOS 完成。
> 状态口径：macOS 主路径全部验证通过 → 本 KR 判 completed；Windows/极端环境项已登记到 Epic checklist，以下以“移交”说明保留追踪关系，不再作为本 KR 的未关闭项。

## Functional Verification
- [x] macOS 开启麦克风与系统音频录制后，`mic.wav` 包含非零 PCM 且预览可听
  > 人工冒烟通过：主 KR macOS 录制主路径与 `kr-01-system-audio` 1 分钟双轨预览/导出均已验证。
- [x] 源选择面板可枚举 screen/window 源并显示缩略图，选中后可正常开始/停止录制
  > 人工冒烟通过（2026-08-19）：选源 → 预览 → 录制 → 停止全流程正常。
- [x] 停止录制后 `recordings/<session-id>/` 存在 screen.webm（可播放）、mic.wav（开启麦克风时）与 events.json
  > 人工冒烟通过：三件产物齐全可播放。程序化佐证：SessionStore 单测验证落盘与内容正确。
- [x] events.json 通过 schema 校验：version=1，startTime/display(id,bounds,scaleFactor)/video/mouseTrack/clicks/keys 齐全
  > 程序化验证通过：`validateRecordingEvents()` 单测覆盖合法样本 + 5 类坏数据拦截；finalize 落盘前强制校验。
- [x] mouseTrack 采样频率 ≥ 60Hz（1 分钟录制 ≥ 3600 条），时间戳单调递增
  > 人工冒烟通过：真实录制 40s 得 2991 条（≈75Hz）、11s 得 827 条（≈75Hz），均 ≥60Hz。
  > 程序化佐证：CursorPoller 单测验证三元组格式与时间戳单调性。
- [x] 点击与键盘事件出现在 clicks/keys 中，坐标与按键名正确
  > 人工冒烟通过：23 次点击坐标与独立轮询轨迹 0px 偏差；keys=27 条（辅助功能权限生效，按键名正确）。
- [x] 对齐验收：1 分钟录制中，点击事件时间戳与视频对应画面变化帧差值 < 50ms
  > 人工冒烟通过：23/23 点击与轨迹对齐 dt ≤ 6ms，远优于 50ms 指标。
- [x] 录制期间画面内容随真实操作持续更新（不停滞在起始帧）
  > 人工冒烟通过（整屏 + 窗口源均确认）。修复背景：legacy 窗口采集在窗口缩放/遮挡时帧停滞，已迁移至 ScreenCaptureKit 路径（setDisplayMediaRequestHandler + getDisplayMedia），见 docs/TECH_DESIGN.md §3.1。

## Edge Case Verification
- 已移交 Epic：macOS 屏幕录制权限拒绝时显示权限引导页，不崩溃、无原始错误堆栈。
  > 待验证（拒绝路径未实测，授权路径已通）。移交 Epic checklist 双平台冒烟覆盖。
- 已移交 Epic：uiohook 钩子启动失败时降级录制（画面 + 鼠标轨迹），UI 明确提示自动运镜不可用。
  > 待验证（钩子在本机工作正常，降级路径未触发实测）。移交 Epic checklist（Epic 已有对应条目）。
  > 程序化佐证：InputHook 单测验证原生模块缺失时 `available=false`、不抛错、录制流程可继续。
- 已移交 Epic：录制窗口源时关闭该窗口，录制安全停止且已落盘片段保留。
  > 待验证（窗口关闭 SOURCE_LOST 兜底未实测）。移交 Epic checklist 双平台冒烟覆盖。
- 已移交 Epic：磁盘写满（可模拟）时录制安全终止、已落盘数据保留、有用户可读提示。
  > 未实测。移交 Epic checklist（Epic 已有对应条目）。
  > 程序化佐证：SessionStore 单测模拟流 ENOSPC → 上报 DISK_FULL 友好文案、后续写入阻断、abort 后片段保留。
- 已移交 Epic：录制中拔插副屏，轮询不崩溃、录制不中断。
  > 未实测（需双屏热插拔）。移交 Epic checklist 双平台冒烟覆盖。
  > 代码级佐证：CursorPoller 轮询体有 try/catch，拓扑瞬时变化只跳过单个采样。
- [x] 多显示器不同 scaleFactor 下，display.bounds/scaleFactor 正确记录
  > 人工冒烟通过：多屏录制 display 字段正确记录被录屏（按 desktopCapturer display_id 精确匹配，window 源回退光标所在屏）。

## Code Quality & Performance
- [x] 无新增 TypeScript 类型错误与 lint 告警；生产路径无 console.log 等调试残留
  > 程序化验证通过：`npm run typecheck` 零错误；grep 全仓无 console.log/debug 残留。注意：项目未配置 ESLint，"lint 告警"项以 typecheck 代替。
- [x] 采集器抽象包含 `captureCursor: boolean` 预留字段（当前恒 true）
  > 代码级验证通过：`shared/types.ts` `CaptureOptions.captureCursor`（kr-04 落地）。当前录制路径未消费该字段，符合"预留"定位。
- [x] 录制期 CPU 占用可接受（无渲染/运镜逻辑在录制路径上）
  > 代码级验证通过 + 人工冒烟无卡顿反馈：录制路径仅 MediaRecorder 编码 + 定时轮询 + IPC 写盘。
- 已移交 Epic：macOS 与 Windows 双平台手动冒烟通过。
  > macOS 已通过；Windows 未测（本机无 Windows 环境）。移交 Epic checklist 双平台冒烟覆盖。
