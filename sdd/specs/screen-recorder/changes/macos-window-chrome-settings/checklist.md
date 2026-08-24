# Verification Checklist: macOS 原生窗口顶栏与设置交互

## Functional Verification

- [ ] 设置抽屉右上角关闭按钮可关闭抽屉。
- [ ] 点击抽屉外遮罩可关闭，点击抽屉内容不会误关闭。
- [ ] 按 Escape 可关闭，关闭后页面其他键盘操作不受影响。
- [ ] macOS 设置界面不显示“关闭应用”，Windows 仍显示并可保存选项。
- [ ] macOS 红色关闭按钮隐藏窗口，Dock 激活恢复同一窗口。
- [ ] macOS `⌘Q` 与菜单栏退出可结束应用。
- [ ] Windows 首次关闭确认、托盘后台与直接退出行为无回归。

## UI & Accessibility

- [ ] macOS 红绿灯同行右侧显示更新、主题、设置入口，中间空白可拖动窗口。
- [ ] 工具按钮点击不会触发拖拽；双击拖拽区遵循系统窗口行为。
- [ ] 品牌信息和录制/预览切换无重叠、无重复工具入口。
- [ ] 浅色与深色主题下顶栏、抽屉遮罩、按钮对比度清晰。
- [ ] 所有图标按钮具有可访问名称和可见键盘焦点。

## Code Quality

- [ ] 平台差异显式分支或拆分，未通过 `navigator.userAgent` 判断。
- [ ] `AppSettings` / IPC 契约无无关变更，既有 macOS `closeBehavior` 数据无需迁移。
- [ ] 单文件不超过 300 行，无调试日志或无关重构。
- [ ] `npm run typecheck` 通过。
- [ ] `npm run build` 通过。
- [ ] `npm run lint` 无新增错误。

## Manual Testing

- [ ] macOS 实机完成设置抽屉、窗口关闭、Dock 恢复、`⌘Q`、深浅主题和拖拽冒烟。
- [ ] Windows 平台项已实机验证，或在交付说明中明确列为待人工验证。
