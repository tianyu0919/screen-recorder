---
id: "kr-05-vfr-playback-smoothing"
kind: change
parent: "kr-05-preview-quality-control"
status: completed
impact_radius:
  - "src/components/preview/"
  - "src/render/compositor.ts"
  - "docs/TECH_DESIGN.md"
dependencies:
  - "kr-02-motion-playback"
  - "kr-05-preview-quality-control"
---

# Specification: VFR 录屏流畅预览

## 1. Scope

- **In Scope**: 将预览中的视频纹理上传与动画合成调度解耦；让低帧率、VFR 和省略静态重复帧的录屏仍能连续推进运镜、字幕、波纹和播放头；保留 seek、拖动、裁剪跳过及循环清理语义。
- **Out of Scope**: 修改录制文件、补帧、转码、导出逐帧管线、音频时钟或持久化格式。

## 2. Functional Requirements

### MODIFIED

#### Requirement: 预览双时钟调度
系统 SHALL 以视频媒体时间为唯一时间轴，用 `requestVideoFrameCallback` 更新解码纹理，并用 `requestAnimationFrame` 合成连续的时间效果。

##### Scenario: VFR 或静态画面省帧
- **WHEN** 源视频在连续播放期间长时间没有新的解码帧
- **THEN** 运镜、字幕动画、点击波纹和播放头仍随 `video.currentTime` 在显示刷新周期内连续推进，画面复用最近成功上传的纹理

##### Scenario: 新视频帧到达
- **WHEN** 浏览器呈现新的解码视频帧
- **THEN** 系统仅上传一次该视频帧，并在后续显示刷新中复用，不因动画刷新重复上传大尺寸源纹理

#### Requirement: 播放交互兼容
系统 SHALL 保持播放、暂停、点击跳转、按住拖动、裁剪跳过和片尾行为不变，并完整清理两类帧回调。

##### Scenario: 暂停或卸载
- **WHEN** 用户暂停播放、视频结束、进入尾部裁剪区或播放器卸载
- **THEN** 系统取消显示刷新和视频帧回调，不留下后台空转循环

##### Scenario: seek 与拖动
- **WHEN** 用户点击时间轴或拖动播放线到有效位置
- **THEN** 系统按现有裁剪吸附规则定位，seek 完成后显示对应视频帧，并按拖动前状态决定是否恢复播放

