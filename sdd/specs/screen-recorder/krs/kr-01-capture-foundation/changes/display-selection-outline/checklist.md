# Verification Checklist: 物理显示器选中边框

## Functional Verification

- [x] 选择整屏来源后，边框显示在 `display_id` 对应的物理显示器，而非主屏或光标所在屏。
- [x] 改选另一显示器时旧边框消失、新边框出现，最多存在一个覆盖窗口。
- [x] 改选窗口来源、预览获取失败或来源失效时边框消失。
- [x] 离开录制页、隐藏/关闭主窗口、退出应用时无边框残留。
- [x] 目标显示器拔出时边框销毁；分辨率或缩放变化时边框 bounds 正确更新。
- [x] 点击开始录制后边框先消失，录制首帧及完整输出不包含边框。
- [x] 录制启动失败后不自动恢复陈旧边框。

## UI & Interaction

- [x] 边框为稳定常亮的 Lenza 橙色，不含文字、图标、闪烁或呼吸动效。
- [x] 边框在浅色、深色桌面内容上均清晰可辨，且边框之外完全透明。
- [x] macOS 与 Windows 的 100%/高 DPI 缩放下四边位置准确、无裁切。
- [x] 覆盖层不抢焦点、不拦截鼠标和键盘操作。
- [x] macOS 选择整屏后 Lenza 主应用仍显示在 Dock 与 `Command + Tab`，辅助边框不单独出现在 Mission Control 或应用切换器中。
- [x] Windows 选择整屏后 Lenza 主窗口仍显示在任务栏与 `Alt + Tab`，辅助边框不产生额外切换项。

## Code Quality

- [x] 平台差异位于 `darwin.ts` / `win32.ts`，分发层不堆叠大段平台判断。
- [x] IPC 与 preload 只暴露必要白名单，不透传 `ipcRenderer`。
- [x] 不修改 `events.json`、录制会话结构或设置持久化格式。
- [x] 所有改动文件不超过 300 行，无调试日志或无关重构。
- [x] `npm run typecheck` 通过。
- [x] `npm run build` 通过。
- [x] 相关 lint 无新增错误，`git diff --check` 通过。

## Manual Testing

- [x] macOS 双显示器人工冒烟通过。
- [x] Windows 双显示器人工冒烟通过（2026-08-25 用户实机确认）。
- [x] 现有整屏/窗口选择、预览流建立、开始/停止录制无回归。
