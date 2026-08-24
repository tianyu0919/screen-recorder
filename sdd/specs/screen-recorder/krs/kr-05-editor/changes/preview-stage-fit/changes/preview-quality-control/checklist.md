# Verification Checklist: 编辑预览清晰度与性能提醒

## Functional Verification

- [x] 编辑布局控制区显示自动、流畅、高清、超清四档，默认自动且标签/当前状态可被键盘和辅助技术识别。
- [x] 四档分别按 design.md 定义的 DPR 和 720p/1080p/1440p 上限计算，均不超过最终输出尺寸。
- [x] 切换档位只重建必要的桶化 backing，保持画面比例、CSS 舞台尺寸、播放位置和播放状态。
- [x] 清晰度在会话切换和应用重启后保留，不写入 `edit.json`，不改变导出尺寸或质量。
- [x] 流畅档进入专注预览后仍使用专注预览的独立高清规则，退出后恢复流畅档。

## Performance Detection & Feedback

- [x] 连续播放预热 3 秒且随后 2 秒呈现率低于源 FPS 70% 时，顶部居中显示一个 warning Toast。
- [x] 暂停、seek、裁剪跳转、时长探针、页面后台、专注预览和流畅档不会触发卡顿 Toast。
- [x] “切换到流畅”立即更新并持久化档位；“保持当前清晰度”在本次打开会话期间抑制后续提醒。
- [x] 同一会话不会堆叠重复 Toast，关闭并重新打开会话后允许重新检测。
- [x] 逐帧性能统计使用 ref/纯对象，不新增每帧 React state 更新或独立 rAF 循环。

## Session Card UI

- [ ] 缩略图不再覆盖时长；时长固定显示在会话 ID 行右侧，并在深浅主题下达到清晰文字对比度。
- [ ] 时长标签在 Hover 动画和不同卡片宽度下不位移、不裁切，会话 ID 过长时优先截断 ID。

## Compatibility & Code Quality

- [x] 旧 AppSettings V2 缺少或包含非法 `previewQuality` 时回退为 `auto`，不升级版本且不阻断启动。
- [ ] Sonner 通过 shadcn CLI 添加并适配 Lenza 语义 token；Toast 操作具有可访问名称和键盘焦点。
- [x] 修改后的页面/组件/模块文件均不超过 300 行；平台无关逻辑保持共享，macOS/Windows 无重复实现。
- [x] `npm run typecheck`、变更文件 ESLint、`npm run build`、相关 smoke 与 `git diff --check` 通过。
- [x] `docs/TECH_DESIGN.md` 与 `sdd/project.md` 已同步。

## Manual Smoke

- [ ] macOS：验证 Retina/普通缩放下四档、重启持久化、Toast 两个操作、专注预览和会话卡片。
- [ ] Windows：完成等价验证，并确认 Toast 不与窗口控制区冲突。
