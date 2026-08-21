# Tasks: UI 重构与 Lenza 品牌落地

- [x] 设计稿：docs/design/mockup（base.css + record.html + editor.html）与两张 1440×900 效果图
- [x] 设计令牌进 tailwind.config.js（accent/surface/line/ink），index.css 拖拽区与 ui-slider
- [x] 组件库：Button 重构、Switch/Slider/Segmented/Chip/icons 新增
- [x] 录制页：App 外壳（mac 拖拽区 + 品牌头 + Segmented）、权限胶囊、SourcePicker 分组卡片、RecordingPanel 录制坞、PermissionGuide 换肤
- [x] 预览页：工具栏 / 舞台 / 检查器（运镜参数 + 会话信息）/ 时间轴三段布局；检查器与滑杆溢出修复（min-w-0）
- [x] electron/main：hiddenInset（darwin）、默认 1280×820、最小 1080×700、app.setName + 开发期 dock.setIcon
- [x] 品牌：Lenza 命名四处同步；build/icon.svg → icon.icns/icon.ico/icon.png
- [x] scripts/patch-electron-name.mjs + postinstall（修复 dev 期 Dock 显示 Electron）；lsregister/Dock 缓存处理
- [x] 录制计时归零修复：recordingStartedAt 入 appStore，RecordingPanel 计时改派生
- [x] npm run typecheck / build 通过
