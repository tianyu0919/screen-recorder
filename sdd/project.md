# SDD 项目注册表：screen-recorder

> 全局 spec 索引。新增/变更 spec 时同步更新本表。唯一事实来源：`docs/TECH_DESIGN.md`。

## Epic

| ID | 名称 | 路径 | 状态 | 依赖 | 简述 |
|---|---|---|---|---|---|
| screen-recorder | Screen Studio 类录屏软件 | [sdd/specs/screen-recorder/](./specs/screen-recorder/spec.md) | in_progress | 无 | Electron 跨平台录屏：录制期采集画面 + 鼠标/键盘事件，导出期基于事件数据做自动缩放运镜、光标美化，输出 1080p60 mp4。 |

## Key Results

| ID | 名称 | 路径 | 状态 | 依赖 | 简述 |
|---|---|---|---|---|---|
| kr-01-capture-foundation | M1 采集底座 | [krs/kr-01-capture-foundation/](./specs/screen-recorder/krs/kr-01-capture-foundation/spec.md) | completed | 无 | electron-vite 脚手架；desktopCapturer 选屏 + MediaRecorder 高码率 webm；鼠标轨迹轮询 + uiohook 事件；会话落盘 events.json。验收：1 分钟录制对齐误差 < 50ms。macOS 主路径已人工冒烟通过（2026-08-19），Windows/极端环境项移交 Epic checklist。 |
| kr-02-motion-playback | M2 运镜回放 | [krs/kr-02-motion-playback/](./specs/screen-recorder/krs/kr-02-motion-playback/spec.md) | completed | kr-01（会话格式契约） | 虚拟相机 {x,y,zoom}、点击自动生成关键帧、spring 阻尼插值、WebGL 合成器、实时预览播放器。macOS 真实会话集成自测通过（2026-08-20），预览已人工确认正常。 |
| kr-03-mp4-export | M3 mp4 导出 | [krs/kr-03-mp4-export/](./specs/screen-recorder/krs/kr-03-mp4-export/spec.md) | in_progress | kr-01（会话格式）、kr-02（渲染管线复用） | Worker 线程离线确定性逐帧渲染；WebCodecs Decoder/Encoder + mp4-muxer；H.264 探测与 VP9+webm / ffmpeg.wasm fallback。macOS 主路径已人工冒烟通过（2026-08-20），双平台/边界项见 checklist。 |
| kr-04-cursor-beautify | M4 光标美化 | [krs/kr-04-cursor-beautify/](./specs/screen-recorder/krs/kr-04-cursor-beautify/spec.md) | draft | kr-01（`captureCursor` 采集抽象） | 原生采集 helper PoC（macOS ScreenCaptureKit / Windows WGC 无光标采集）；轨迹去抖 + catmull-rom 平滑；矢量光标重绘换肤。 |
| kr-05-editor | M5 编辑器 | [krs/kr-05-editor/](./specs/screen-recorder/krs/kr-05-editor/spec.md) | in_progress | kr-02、kr-03（编辑结果作用于预览与导出） | 手动关键帧调整、片段删除、webcam 画中画、按键回显，完成 MVP 闭环。时间轴交互与裁剪已由 change: timeline-editing 交付（2026-08-21）。 |
| kr-06-captions | M6 本地实时字幕与字幕编辑 | [krs/kr-06-captions/](./specs/screen-recorder/krs/kr-06-captions/spec.md) | draft | kr-01、kr-02、kr-03、kr-05 | 麦克风本地 whisper.cpp 双遍识别；录制中不可捕获的临时字幕；停录后最终字幕；字幕轨、全局样式、全局/单段位置；MP4 烧录与 SRT。 |

## Changes

| ID | 名称 | 路径 | 状态 | 归属 | 简述 |
|---|---|---|---|---|---|
| kr-01-system-audio | 系统音频采集 | [kr-01-capture-foundation/changes/system-audio/](./specs/screen-recorder/krs/kr-01-capture-foundation/changes/system-audio/spec.md) | completed | kr-01 | Windows 走 getDisplayMedia loopback；macOS 走原生 helper（native/sck-audio，ScreenCaptureKit）。预览双轨同步、导出双轨混音。macOS 人工冒烟通过（2026-08-20）。Windows 路径已被 win32-native-audio 取代。 |
| kr-01-win32-native-audio | Windows 系统音频原生化 | [kr-01-capture-foundation/changes/win32-native-audio/](./specs/screen-recorder/krs/kr-01-capture-foundation/changes/win32-native-audio/spec.md) | completed | kr-01 | Windows 改走原生 helper（native/wasapi-audio，Rust + WASAPI loopback）修杂音；VB-Audio 虚拟设备（Voicemeeter/VB-Cable）自动绕行总线采集端点 + Remote API 路由管理；mic/system 双轨回声互相关对齐。Windows 实机（Voicemeeter 环境）验证通过（2026-08-21）。 |
| ui-redesign-brand | UI 重构与 Lenza 品牌 | [screen-recorder/changes/ui-redesign-brand/](./specs/screen-recorder/changes/ui-redesign-brand/spec.md) | completed | screen-recorder | 深色设计令牌 + 组件库；录制页（权限胶囊/分组选源/录制坞）与预览编辑器（工具栏/舞台/检查器/时间轴）重构；Lenza 命名与图标（icns/ico）、macOS 无边框窗口、dev 期 Dock/菜单栏名称修复。 |
| ui-modern-light-motion-refresh | Lenza 现代浅色界面与动效升级 | [ui-redesign-brand/changes/modern-light-motion-refresh/](./specs/screen-recorder/changes/ui-redesign-brand/changes/modern-light-motion-refresh/spec.md) | in_progress | ui-redesign-brand, kr-01, kr-02, kr-03, kr-05 | 在既有真实录制/预览/导出链路上升级浅色优先双主题、三大视图、Motion、响应式与无障碍；已完成基线审计，正在实施。 |
| session-library-settings | 会话库、回收站与应用设置 | [screen-recorder/changes/session-library-settings/](./specs/screen-recorder/changes/session-library-settings/spec.md) | in_progress | kr-01, ui-modern-light-motion-refresh | 多保存路径统一历史、内部回收站与到期清理、版本化 Main 设置、默认视频路径，以及 Windows 托盘/macOS Dock 关闭行为。 |
| app-auto-update | 应用更新检测与安装 | [screen-recorder/changes/app-auto-update/](./specs/screen-recorder/changes/app-auto-update/spec.md) | in_progress | session-library-settings, ui-modern-light-motion-refresh | 正式 GitHub Release 检测；Windows 用户确认下载与重启安装；macOS 未签名阶段降级为 Release 跳转；设置持久化与顶部升级入口。 |
| macos-window-chrome-settings | macOS 原生窗口顶栏与设置交互 | [screen-recorder/changes/macos-window-chrome-settings/](./specs/screen-recorder/changes/macos-window-chrome-settings/spec.md) | in_progress | session-library-settings, ui-modern-light-motion-refresh | 修复设置抽屉关闭；macOS 红灯固定隐藏、Dock 恢复、⌘Q 退出；红绿灯同行承载更新/主题/设置，Windows 保留关闭策略与自绘窗口控件。 |
| kr-05-timeline-editing | 时间轴编辑（缩放/片段倍率/裁剪） | [kr-05-editor/changes/timeline-editing/](./specs/screen-recorder/krs/kr-05-editor/changes/timeline-editing/spec.md) | completed | kr-05 | 滚轮锚点缩放与平移、播放头缓动跟随；运镜片段级倍率覆盖（合并片段整段生效）；非破坏式裁剪（刻度尺框选、预览跳过、导出映射 + 音频拼接）；真实时长探针。macOS 验证通过（2026-08-21）。编辑状态持久化（edit.json）已定档为后续计划，见 spec「后续计划」。 |
| kr-05-audio-volume | 编辑器音频音量控制 | [kr-05-editor/changes/audio-volume/](./specs/screen-recorder/krs/kr-05-editor/changes/audio-volume/spec.md) | in_progress | kr-05 | 检查器「音频」区分轨增益滑杆（mic/system 各 0–100%）；预览实时生效；导出混音应用同一增益。 |
| kr-05-custom-audio-track | 自定义音轨（波形+拖拽/裁剪） | [kr-05-editor/changes/custom-audio-track/](./specs/screen-recorder/krs/kr-05-editor/changes/custom-audio-track/spec.md) | in_progress | kr-05, kr-05-audio-volume | 外部音频文件（BGM/旁白）入编辑器：波形块拖拽定位与双端裁剪；预览/导出共用 trim 区间与 N 轨混音。Windows 连续播放仍有轻微卡顿，记为 P2 暂缓。 |
| kr-05-preview-stage-fit | 编辑器舞台自适应与检查器收起 | [kr-05-editor/changes/preview-stage-fit/](./specs/screen-recorder/krs/kr-05-editor/changes/preview-stage-fit/spec.md) | in_progress | kr-02, kr-05 | ResizeObserver 精确计算预览 Canvas 等比尺寸；适应/100% 模式；检查器手动收起释放舞台宽度。 |
| kr-02-cursor-follow-camera | 放大运镜鼠标安全区跟随 | [kr-02-motion-playback/changes/cursor-follow-camera/](./specs/screen-recorder/krs/kr-02-motion-playback/changes/cursor-follow-camera/spec.md) | in_progress | kr-01, kr-02 | 已实现稀疏安全区跟随；正在将阈值由中央 60% 调整为中央 40%（中心横纵各 ±20%），保持 spring、边缘钳制和预览/导出一致。 |
| kr-05-interactive-timeline-effects | 可编辑运镜、事件与自动保存 | [kr-05-editor/changes/interactive-timeline-effects/](./specs/screen-recorder/krs/kr-05-editor/changes/interactive-timeline-effects/spec.md) | in_progress | kr-02-cursor-follow-camera, kr-05-timeline-editing, kr-05-custom-audio-track | 运镜块拖动/双端拉伸/新增删除与波纹关联；右键添加运镜、键盘提示、音频；键盘隐私过滤与画面回显；事件 LOD/虚拟化；edit.json 自动保存、状态提示及最近编辑时间。 |

## 依赖关系总览

```
kr-01-capture-foundation ──┬──> kr-02-motion-playback ──> kr-03-mp4-export ──> kr-05-editor
                           └──> kr-04-cursor-beautify（可与 kr-02/kr-03 并行）
kr-01/02/03/05 ────────────────────────────────────────────────────────> kr-06-captions
```

执行顺序建议（见 [Epic tasks.md](./specs/screen-recorder/tasks.md)）：kr-01 → kr-02 → kr-03 为主线；kr-04 在 kr-01 完成后可与主线并行；kr-05 编辑闭环后启动 kr-06 字幕，kr-06 与 kr-04 后续实现可并行。
