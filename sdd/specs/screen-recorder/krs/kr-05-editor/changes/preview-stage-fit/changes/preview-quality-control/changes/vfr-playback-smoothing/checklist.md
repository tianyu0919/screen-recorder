# Verification Checklist: VFR 录屏流畅预览

## Functional Verification

- [x] 低帧率/VFR 源连续播放时，播放头和运镜按显示刷新连续推进。
- [x] 新解码帧只在 rVFC 路径上传，rAF 合成复用最近纹理。
- [x] 点击跳转、按住拖动及拖动后的播放状态恢复保持正常。
- [x] 裁剪区跳过、尾部裁剪停止和片尾结束保持正常。
- [x] 暂停、片尾、卸载会取消 rAF 和 rVFC，不留空转循环。
- [x] 导出继续通过 `drawFrame` 一入一画，行为不变。

## Code Quality

- [x] 修改后的源文件均不超过 300 行。
- [x] `npm run typecheck` 通过。
- [x] 变更文件 ESLint 通过。
- [x] `npm run build` 通过。
- [x] `git diff --check` 通过。

## Manual Smoke

- [x] macOS：使用实际低帧率会话验证播放、seek、拖动、暂停和时间轴跟随。
- [ ] Windows：保留等价回归项。
