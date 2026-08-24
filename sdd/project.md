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
| kr-03-mp4-export | M3 mp4 导出 | [krs/kr-03-mp4-export/](./specs/screen-recorder/krs/kr-03-mp4-export/spec.md) | in_progress | kr-01（会话格式）、kr-02（渲染管线复用） | Worker 线程离线确定性逐帧渲染；WebCodecs Decoder/Encoder + mp4-muxer；正常会话 macOS/Windows 导出均已实机通过；确定性、取消、fallback、损坏源与慢机器边界项仍待验收。 |
| kr-04-cursor-beautify | M4 光标美化 | [krs/kr-04-cursor-beautify/](./specs/screen-recorder/krs/kr-04-cursor-beautify/spec.md) | draft | kr-01（`captureCursor` 采集抽象） | 原生采集 helper PoC（macOS ScreenCaptureKit / Windows WGC 无光标采集）；轨迹去抖 + catmull-rom 平滑；矢量光标重绘换肤。 |
| kr-05-editor | M5 编辑器 | [krs/kr-05-editor/](./specs/screen-recorder/krs/kr-05-editor/spec.md) | in_progress | kr-02、kr-03（编辑结果作用于预览与导出） | 运镜编辑、非破坏式裁剪、按键回显与 edit.json 自动保存已由子 change 交付；父 KR 仍缺 webcam 采集/画中画及完整双平台集成验收。 |
| kr-06-captions | M6 录制后离线字幕与编辑 | [krs/kr-06-captions/](./specs/screen-recorder/krs/kr-06-captions/spec.md) | draft | kr-01、kr-02、kr-03、kr-05 | 第一阶段按 change 收敛为编辑页从 `mic.wav` 本地离线生成字幕；后台任务、字幕轨、样式/位置、MP4 烧录与裁剪后 SRT；实时字幕留待后续。 |
| kr-07-voice-packs | M7 本地语音包与非破坏式变声 | [krs/kr-07-voice-packs/](./specs/screen-recorder/krs/kr-07-voice-packs/spec.md) | draft | kr-01、kr-03、kr-05 | 原声、低沉、清亮、广播、机器人本地 DSP 预设；Worker 等长派生 WAV、缓存、A/B 切换及预览/裁剪/导出一致；AI 音色与 TTS 不在一期。 |

## Changes

| ID | 名称 | 路径 | 状态 | 归属 | 简述 |
|---|---|---|---|---|---|
| kr-01-system-audio | 系统音频采集 | [kr-01-capture-foundation/changes/system-audio/](./specs/screen-recorder/krs/kr-01-capture-foundation/changes/system-audio/spec.md) | completed | kr-01 | Windows 走 getDisplayMedia loopback；macOS 走原生 helper（native/sck-audio，ScreenCaptureKit）。预览双轨同步、导出双轨混音。macOS 人工冒烟通过（2026-08-20）。Windows 路径已被 win32-native-audio 取代。 |
| kr-01-win32-native-audio | Windows 系统音频原生化 | [kr-01-capture-foundation/changes/win32-native-audio/](./specs/screen-recorder/krs/kr-01-capture-foundation/changes/win32-native-audio/spec.md) | completed | kr-01 | Windows 改走原生 helper（native/wasapi-audio，Rust + WASAPI loopback）修杂音；VB-Audio 虚拟设备（Voicemeeter/VB-Cable）自动绕行总线采集端点 + Remote API 路由管理；mic/system 双轨回声互相关对齐。Windows 实机（Voicemeeter 环境）验证通过（2026-08-21）。 |
| kr-01-microphone-permission-flow | 麦克风权限与可选录制流程 | [kr-01-capture-foundation/changes/microphone-permission-flow/](./specs/screen-recorder/krs/kr-01-capture-foundation/changes/microphone-permission-flow/spec.md) | in_progress | kr-01, ui-modern-light-motion-refresh | 已授权状态可用；Windows 当前机器已有全部权限，首次申请/拒绝/撤权场景未测；macOS 首次授权、设置跳转、撤权与无麦克风录制仍待完整冒烟。 |
| kr-01-display-selection-outline | 物理显示器选中边框 | [kr-01-capture-foundation/changes/display-selection-outline/](./specs/screen-recorder/krs/kr-01-capture-foundation/changes/display-selection-outline/spec.md) | completed | kr-01, ui-modern-light-motion-refresh | macOS 与 Windows 双屏人工冒烟通过；选择/改选、鼠标穿透、任务栏/Alt+Tab、显示器变化及录制首帧均已验证。 |
| kr-01-window-capture-fixed-canvas | 窗口录制固定画布与动态几何 | [kr-01-capture-foundation/changes/window-capture-fixed-canvas/](./specs/screen-recorder/krs/kr-01-capture-foundation/changes/window-capture-fixed-canvas/spec.md) | in_progress | kr-01, kr-02, kr-03 | 窗口录制以开始显示器物理分辨率冻结画布；双平台持续采样窗口 bounds；移动/缩放/最大化时统一修正波纹、自动运镜、跟随与预览导出。Windows 实机冒烟及 2560×1440 恒定 60fps 导出已通过（2026-08-25）；待 macOS helper 构建及等价实机验收。 |
| ui-redesign-brand | UI 重构与 Lenza 品牌 | [screen-recorder/changes/ui-redesign-brand/](./specs/screen-recorder/changes/ui-redesign-brand/spec.md) | completed | screen-recorder | 深色设计令牌 + 组件库；录制页（权限胶囊/分组选源/录制坞）与预览编辑器（工具栏/舞台/检查器/时间轴）重构；Lenza 命名与图标（icns/ico）、macOS 无边框窗口、dev 期 Dock/菜单栏名称修复。 |
| ui-modern-light-motion-refresh | Lenza 现代浅色界面与动效升级 | [ui-redesign-brand/changes/modern-light-motion-refresh/](./specs/screen-recorder/changes/ui-redesign-brand/changes/modern-light-motion-refresh/spec.md) | in_progress | ui-redesign-brand, kr-01, kr-02, kr-03, kr-05 | 主题、三视图、Motion 与主要 UI 已交付，Windows 视觉/关键交互冒烟及 lint/typecheck/build 通过；仍待目标窗口尺寸、无障碍/颜色清理、macOS 和 1 分钟录制验收。 |
| session-library-settings | 会话库、回收站与应用设置 | [screen-recorder/changes/session-library-settings/](./specs/screen-recorder/changes/session-library-settings/spec.md) | completed | kr-01, ui-modern-light-motion-refresh | 多保存路径统一历史、内部回收站与到期清理、版本化 Main 设置、默认视频路径，以及 Windows 托盘/macOS Dock 关闭行为。 |
| app-auto-update | 应用更新检测与安装 | [screen-recorder/changes/app-auto-update/](./specs/screen-recorder/changes/app-auto-update/spec.md) | completed | session-library-settings, ui-modern-light-motion-refresh | 正式 GitHub Release 检测；Windows 用户确认下载与重启安装；macOS 未签名阶段降级为 Release 跳转；设置持久化与顶部升级入口。 |
| macos-window-chrome-settings | macOS 原生窗口顶栏与设置交互 | [screen-recorder/changes/macos-window-chrome-settings/](./specs/screen-recorder/changes/macos-window-chrome-settings/spec.md) | completed | session-library-settings, ui-modern-light-motion-refresh | 修复设置抽屉关闭；macOS 红灯固定隐藏、Dock 恢复、⌘Q 退出；红绿灯同行承载更新/主题/设置，Windows 保留关闭策略与自绘窗口控件。 |
| kr-05-timeline-editing | 时间轴编辑（缩放/片段倍率/裁剪） | [kr-05-editor/changes/timeline-editing/](./specs/screen-recorder/krs/kr-05-editor/changes/timeline-editing/spec.md) | completed | kr-05 | 滚轮锚点缩放与平移、播放头缓动跟随；运镜片段级倍率覆盖；非破坏式裁剪（预览跳过、导出映射 + 音频拼接）与真实时长探针。后续 edit.json 持久化已由 interactive-timeline-effects 交付。 |
| kr-05-playhead-scrubbing | 播放线拖动与裁剪区定位规则 | [timeline-editing/changes/playhead-scrubbing/](./specs/screen-recorder/krs/kr-05-editor/changes/timeline-editing/changes/playhead-scrubbing/spec.md) | in_progress | kr-05-timeline-editing | 整条播放线可拖动；播放状态按拖动前状态恢复；点击裁剪区无效，拖入裁剪区按有效内容边界吸附；已裁区使用统一 Tooltip。 |
| kr-05-audio-volume | 编辑器音频音量控制 | [kr-05-editor/changes/audio-volume/](./specs/screen-recorder/krs/kr-05-editor/changes/audio-volume/spec.md) | completed | kr-05 | 检查器「音频」区分轨增益滑杆（mic/system 各 0–100%）；预览实时生效；导出混音应用同一增益。 |
| kr-05-custom-audio-track | 自定义音轨（波形+拖拽/裁剪） | [kr-05-editor/changes/custom-audio-track/](./specs/screen-recorder/krs/kr-05-editor/changes/custom-audio-track/spec.md) | completed | kr-05, kr-05-audio-volume | 外部音频文件以波形块拖拽定位与双端裁剪；预览/导出共用 trim 区间与 N 轨混音。多轨布局与残余体验问题已转入后续 change。 |
| kr-05-preview-stage-fit | 编辑器舞台自适应与检查器收起 | [kr-05-editor/changes/preview-stage-fit/](./specs/screen-recorder/krs/kr-05-editor/changes/preview-stage-fit/spec.md) | completed | kr-02, kr-05 | ResizeObserver 精确计算预览 Canvas 等比尺寸；适应/100% 模式；检查器手动收起释放舞台宽度。 |
| kr-05-preview-quality-control | 编辑预览清晰度与性能提醒 | [preview-stage-fit/changes/preview-quality-control/](./specs/screen-recorder/krs/kr-05-editor/changes/preview-stage-fit/changes/preview-quality-control/spec.md) | in_progress | kr-05-preview-stage-fit, kr-05-focus-preview, session-library-settings | 自动/流畅/高清/超清四档本机偏好；持续卡顿检测与顶部居中 Sonner 降档提示；会话卡片时长移入正文元数据行。 |
| kr-02-cursor-follow-camera | 放大运镜鼠标安全区跟随 | [kr-02-motion-playback/changes/cursor-follow-camera/](./specs/screen-recorder/krs/kr-02-motion-playback/changes/cursor-follow-camera/spec.md) | completed | kr-01, kr-02 | 基础安全区/即时跟随、边缘钳制与预览/导出一致性已交付；抖动、延迟和到位后黏连移动转入稳定性 change。 |
| kr-02-cursor-follow-stability | 鼠标跟随稳定性与提前响应 | [cursor-follow-camera/changes/cursor-follow-stability/](./specs/screen-recorder/krs/kr-02-motion-playback/changes/cursor-follow-camera/changes/cursor-follow-stability/spec.md) | draft | kr-02-cursor-follow-camera, kr-05-interactive-timeline-effects | 以位移阈值、滞回和轨迹前瞻替代逐点追踪：大幅移动提前柔和响应，到位后微动不继续追踪。 |
| kr-05-interactive-timeline-effects | 可编辑运镜、事件与自动保存 | [kr-05-editor/changes/interactive-timeline-effects/](./specs/screen-recorder/krs/kr-05-editor/changes/interactive-timeline-effects/spec.md) | completed | kr-02-cursor-follow-camera, kr-05-timeline-editing, kr-05-custom-audio-track | 运镜块拖动/双端拉伸/新增删除与波纹关联；右键添加运镜、键盘提示、音频；键盘隐私过滤与画面回显；事件 LOD/虚拟化；edit.json 自动保存、状态提示及最近编辑时间。 |
| kr-05-multi-track-audio-editing | 多轨音频时间线与片段裁剪 | [custom-audio-track/changes/multi-track-audio-editing/](./specs/screen-recorder/krs/kr-05-editor/changes/custom-audio-track/changes/multi-track-audio-editing/spec.md) | draft | kr-05-custom-audio-track, kr-05-interactive-timeline-effects | 原始录音下增加多条自定义音轨；一轨多片段、跨轨移动、双端裁剪、轨道增益/静音、V1 迁移及预览/导出一致。 |
| kr-05-render-composition-controls | 运镜、静音与背景画布控制 | [kr-05-editor/changes/render-composition-controls/](./specs/screen-recorder/krs/kr-05-editor/changes/render-composition-controls/spec.md) | in_progress | kr-05-interactive-timeline-effects, kr-05-audio-volume, kr-05-custom-audio-track, kr-05-preview-stage-fit, kr-03-mp4-export | 运镜总开关与 1.0x 下限；分轨可恢复静音；移除强制圆角/阴影；可选纯色背景；源尺寸输出及编码能力等比降档。 |
| kr-05-background-padding | 背景画面边距控制 | [render-composition-controls/changes/background-padding/](./specs/screen-recorder/krs/kr-05-editor/changes/render-composition-controls/changes/background-padding/spec.md) | completed | kr-05-render-composition-controls | 0%–20% 统一画面边距；运镜保持固定内容窗口；macOS 与 Windows 预览一致性已完成实机验证。 |
| kr-05-focus-preview | 跨平台专注预览 | [kr-05-editor/changes/focus-preview/](./specs/screen-recorder/krs/kr-05-editor/changes/focus-preview/spec.md) | in_progress | kr-05-preview-stage-fit, kr-05-render-composition-controls | 当前窗口只读最终效果；专注模式强制适应且可最大化/还原到屏幕工作区；退出恢复进入前窗口状态。Windows 实机冒烟通过（2026-08-25），待 macOS 等价验收。 |
| kr-06-post-recording-captions | 录制后离线字幕生成与编辑 | [kr-06-captions/changes/post-recording-captions/](./specs/screen-recorder/krs/kr-06-captions/changes/post-recording-captions/spec.md) | draft | kr-06-captions, kr-01, kr-02, kr-03, kr-05 | 用录制后按需离线转写替代原实时双遍首期范围；任务按会话隔离，支持编辑、样式/位置、MP4 烧录和裁剪后 SRT。 |

## 依赖关系总览

```
kr-01-capture-foundation ──┬──> kr-02-motion-playback ──> kr-03-mp4-export ──> kr-05-editor
                           └──> kr-04-cursor-beautify（可与 kr-02/kr-03 并行）
kr-01/02/03/05 ────────────────────────────────────────────────────────> kr-06-captions
kr-01/03/05 ───────────────────────────────────────────────────────────> kr-07-voice-packs
```

执行顺序建议（见 [Epic tasks.md](./specs/screen-recorder/tasks.md)）：kr-01 → kr-02 → kr-03 为主线；kr-04 在 kr-01 完成后可与主线并行；kr-05 编辑闭环后可并行启动 kr-06 录制后字幕与 kr-07 本地语音包。
