---
id: "kr-02-motion-playback"
kind: kr
parent: "screen-recorder"
status: completed
impact_radius:
  - "src/timeline/"
  - "src/render/"
  - "src/components/"
dependencies:
  - "kr-01-capture-foundation"
---

# Specification: kr-02-motion-playback（M2 运镜回放） (Specification)

## 0. Key Result Statement (KR only)
实现虚拟相机模型与 WebGL 合成器，读取 kr-01 录制的会话，由点击事件自动生成相机关键帧并以 spring 阻尼插值驱动运镜，提供实时预览播放器；验收指标：点击处自动 zoom，动画平滑无生硬跳变。
- **Parent Epic**: [screen-recorder](../../spec.md)
- **Target Metric**: 任意点击事件处自动触发缩放运镜；相机动画全程无可见跳变；预览播放跟随视频时间轴流畅（主流机型无明显掉帧）。

## 1. Scope
- **In Scope**:
  - 虚拟相机模型 `{ x, y, zoom }`（视口中心点 + 缩放倍率，输出视口 1920×1080）
  - 自动关键帧生成：点击前 ~200ms 生成"缩放到点击区域"目标状态，无操作超 N 秒回归 1.0x 全景；规则参数化（目标缩放倍率、停留时长、回归阈值）
  - spring 阻尼曲线插值（react-spring 物理模型或手写 RK4）
  - WebGL 合成器（自研 shader 或 PixiJS）：视频纹理仿射变换 + 背景渐变 + 圆角阴影 + 点击波纹叠加
  - 实时预览播放器：`<video>` + `requestVideoFrameCallback` 驱动，播放/暂停/拖拽进度
  - 多显示器坐标换算（基于 events.json 的 display.bounds/scaleFactor）
- **Out of Scope**:
  - 离线逐帧导出（kr-03，但渲染管线必须为导出可复用而设计）
  - 光标矢量重绘与平滑（kr-04；MVP 光标已烧录在画面里）
  - 手动关键帧编辑、片段删除（kr-05）
  - webcam 画中画、按键回显叠加层（kr-05）

## 2. Functional Requirements

### ADDED

#### Requirement: 录制会话加载
The system SHALL 读取 kr-01 落盘的录制会话（events.json + screen.webm），解析并校验 schema，构建内存时间线模型。

##### Scenario: 正常加载
- **WHEN** 用户选择一个完整录制会话
- **THEN** 系统解析 events.json，视频时长与事件时间轴一致，进入预览界面

##### Scenario: events.json 损坏或版本不兼容
- **WHEN** events.json 无法解析或 version 不受支持
- **THEN** 系统提示"会话数据损坏或不兼容"，不进入预览，不抛出原始堆栈

#### Requirement: 自动关键帧生成
The system SHALL 遍历 clicks 事件，在每次点击前 ~200ms 生成缩放到点击区域的相机目标状态，并在无操作超过 N 秒后生成回归 1.0x 全景的关键帧；目标缩放倍率、停留时长、回归阈值均可参数化配置。

##### Scenario: 单次点击
- **WHEN** 时间线 t=1200ms 处有一次点击，坐标 (512, 300)
- **THEN** 关键帧序列包含 t≈1000ms 的"缩放至点击区域"目标状态，停留后回归全景

##### Scenario: 连续密集点击
- **WHEN** 两次点击间隔小于停留时长
- **THEN** 相机直接过渡到第二个点击区域，不插入回归全景的中间关键帧

##### Scenario: 无任何点击事件（钩子降级录制的会话）
- **WHEN** 会话 clicks 为空
- **THEN** 相机全程保持 1.0x 全景，预览正常播放且 UI 提示无运镜数据

#### Requirement: spring 相机动画
The system SHALL 在关键帧之间用 spring 阻尼曲线插值相机状态（x/y/zoom），保证运动平滑有"肉感"，无生硬线性切换。

##### Scenario: 平滑过渡
- **WHEN** 播放经过任一关键帧区间
- **THEN** 相机位置与缩放连续变化，无瞬时跳变；逐帧采样 zoom 曲线单调趋近目标、无硬拐点

##### Scenario: 缩放出界保护
- **WHEN** 点击坐标位于画面边缘，缩放后视口会超出画布
- **THEN** 相机位置被钳制在画布边界内，不出现黑边穿帮（背景渐变区域除外）

#### Requirement: WebGL 合成与实时预览
The system SHALL 用 WebGL（自研 shader 或 PixiJS）按"背景渐变 → 视频画面（圆角 + 阴影）→ 点击波纹"顺序合成每一帧，预览由 `<video>` + `requestVideoFrameCallback` 实时驱动，支持播放/暂停/拖拽进度。

##### Scenario: 实时预览播放
- **WHEN** 用户点击播放
- **THEN** 视频画面按相机状态实时变换呈现，点击时刻叠加波纹动画，播放与视频时间轴同步

##### Scenario: 拖拽进度条
- **WHEN** 用户拖拽进度到任意时间点
- **THEN** 画面立即呈现该时间点的相机状态与合成结果，无长时间黑屏

##### Scenario: 高分辨率源（5K 屏录制）
- **WHEN** 源视频分辨率超过 WebGL 纹理尺寸上限
- **THEN** 系统对输入纹理降采样并在 UI 明示输出分辨率变化，不崩溃、不花屏

##### Scenario: 多显示器 scaleFactor 换算
- **WHEN** 会话录制于 scaleFactor=2 的显示器，事件坐标为屏幕物理坐标
- **THEN** 运镜落点经 display.bounds/scaleFactor 换算后与视频画面中实际点击位置重合（目视无可见偏移）
