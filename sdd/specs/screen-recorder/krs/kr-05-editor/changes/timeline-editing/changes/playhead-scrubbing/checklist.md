# Verification Checklist: 播放线拖动与裁剪区定位规则

## Functional Verification

- [ ] 整条播放线均可抓取拖动，命中不要求精确点中 1.5px 视觉线
- [ ] 播放中拖动会临时暂停并在松手后继续，暂停中拖动在松手后保持暂停
- [ ] 单击裁剪区不改变播放位置
- [ ] 拖入中间裁剪区按鼠标距离吸附到最近边界
- [ ] 开头裁剪只能吸附右边界，尾部裁剪只能吸附左边界
- [ ] 无开头裁剪时可精确拖到 `0ms`；有开头裁剪时不能进入被裁区
- [ ] 已裁剪区使用与主题切换一致的项目 Tooltip，不出现浏览器原生 `title` 提示

## Code Quality

- [x] `npm run typecheck` 通过
- [x] 涉及文件 ESLint 通过
- [x] `npm run build` 与 `git diff --check` 通过
- [x] 所有组件文件不超过 300 行，未留下调试日志

## Manual Smoke

- [ ] macOS：无裁剪、开头裁剪、中间裁剪、尾部裁剪四种会话交互通过
- [ ] Windows：上述四种会话交互通过
