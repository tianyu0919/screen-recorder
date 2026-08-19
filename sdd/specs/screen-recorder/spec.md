---
id: "screen-recorder"
kind: epic
parent: ""
status: in_progress
impact_radius:
  - "electron/"
  - "src/"
  - "docs/"
  - "sdd/"
dependencies:
  - "none"
key_results:
  - "kr-01-capture-foundation"
  - "kr-02-motion-playback"
  - "kr-03-mp4-export"
  - "kr-04-cursor-beautify"
  - "kr-05-editor"
---

# Specification: screen-recorder（Screen Studio 类录屏软件） (Specification)

## 0. Objective (Epic only)
交付一款跨平台（macOS/Windows）的 Electron 录屏工具：录制时同步采集鼠标轨迹/点击/键盘事件，导出时基于事件数据自动完成缩放运镜与光标美化，产出 1080p60 mp4 演示视频；验收基准为"录制 → 自动运镜预览 → 导出"端到端闭环，且事件与视频时间轴对齐误差 < 50ms。

### Key Results
- **[kr-01-capture-foundation](./krs/kr-01-capture-foundation/spec.md)** — Target: M1 采集底座；选屏录制 + 鼠标/键盘事件同步落盘 `events.json`，时间轴对齐误差 < 50ms。
- **[kr-02-motion-playback](./krs/kr-02-motion-playback/spec.md)** — Target: M2 运镜回放；读取录制会话，点击处自动 zoom，spring 相机动画平滑预览播放。
- **[kr-03-mp4-export](./krs/kr-03-mp4-export/spec.md)** — Target: M3 导出；Worker 离线确定性逐帧渲染，输出 1080p60 mp4，与预览一致。
- **[kr-04-cursor-beautify](./krs/kr-04-cursor-beautify/spec.md)** — Target: M4 光标美化；原生采集 helper PoC 产出无光标画面，矢量光标重绘可放大/换肤，轨迹平滑。
- **[kr-05-editor](./krs/kr-05-editor/spec.md)** — Target: M5 编辑器；手动关键帧调整、片段删除、webcam 画中画、按键回显，完成完整 MVP 闭环。
