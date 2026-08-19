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
| kr-02-motion-playback | M2 运镜回放 | [krs/kr-02-motion-playback/](./specs/screen-recorder/krs/kr-02-motion-playback/spec.md) | draft | kr-01（会话格式契约） | 虚拟相机 {x,y,zoom}、点击自动生成关键帧、spring 阻尼插值、WebGL 合成器、实时预览播放器。 |
| kr-03-mp4-export | M3 mp4 导出 | [krs/kr-03-mp4-export/](./specs/screen-recorder/krs/kr-03-mp4-export/spec.md) | draft | kr-01（会话格式）、kr-02（渲染管线复用） | Worker 线程离线确定性逐帧渲染；WebCodecs Decoder/Encoder + mp4-muxer；H.264 探测与 VP9+webm / ffmpeg.wasm fallback。 |
| kr-04-cursor-beautify | M4 光标美化 | [krs/kr-04-cursor-beautify/](./specs/screen-recorder/krs/kr-04-cursor-beautify/spec.md) | draft | kr-01（`captureCursor` 采集抽象） | 原生采集 helper PoC（macOS ScreenCaptureKit / Windows WGC 无光标采集）；轨迹去抖 + catmull-rom 平滑；矢量光标重绘换肤。 |
| kr-05-editor | M5 编辑器 | [krs/kr-05-editor/](./specs/screen-recorder/krs/kr-05-editor/spec.md) | draft | kr-02、kr-03（编辑结果作用于预览与导出） | 手动关键帧调整、片段删除、webcam 画中画、按键回显，完成 MVP 闭环。 |

## 依赖关系总览

```
kr-01-capture-foundation ──┬──> kr-02-motion-playback ──> kr-03-mp4-export ──> kr-05-editor
                           └──> kr-04-cursor-beautify（可与 kr-02/kr-03 并行）
```

执行顺序建议（见 [Epic tasks.md](./specs/screen-recorder/tasks.md)）：kr-01 → kr-02 → kr-03 为主线；kr-04 在 kr-01 完成后可与主线并行；kr-05 最后启动。
