# Design: 窗口录制固定画布与动态几何 (Design)

## 1. Architecture

窗口录制增加两条同步但解耦的管线：Main 进程通过双平台原生 helper 采样窗口屏幕几何；Renderer 将捕获轨转交 Worker，在固定物理画布内逐帧等比适配，再把归一化视频轨交给现有 MediaRecorder。录制期不生成运镜或波纹，只做保证编码契约稳定所必需的来源归一化。

```text
desktopCapturer window track ──> TrackProcessor Worker ──> fixed canvas track ──> MediaRecorder
selected window id ──> darwin/win32 geometry helper ──> windowGeometry[] ──> events.json V2
events + geometry ──> shared coordinate mapper ──> camera / cursor follow / ripple
```

平台代码按项目规则拆分：

- `electron/capture/windowGeometry/index.ts`：仅负责平台分发和生命周期。
- `electron/capture/windowGeometry/darwin.ts`：启动打包的 CoreGraphics/ScreenCaptureKit Swift helper。
- `electron/capture/windowGeometry/win32.ts`：启动 Win32/DWM Rust helper，并用 Electron `screenToDipRect` 把物理 bounds 转为混合 DPI 安全的全局 DIP。
- `native/window-geometry/{darwin,win32}/`：各平台 helper 与构建入口；打包后放入 `resourcesPath` 根。
- 不支持或 helper 失败时返回 `null` 并使用旧显示器换算，不阻断画面录制。

固定画布归一化使用 `MediaStreamTrackProcessor`、`VideoFrame`、`OffscreenCanvas` 与 `VideoTrackGenerator` 的 Worker 管线；WritableStream 背压控制同一时刻只保留有限帧，所有输入/输出帧必须显式 `close()`。

## 2. Data Model & Interfaces

`events.json` 升级为 V2；读取端同时接受 V1，加载后归一化为内部统一结构。

```typescript
type WindowGeometrySample = [
  t: number,
  x: number,
  y: number,
  width: number,
  height: number
]

interface RecordingEventsV2 {
  version: 2
  startTime: number
  display: DisplayInfo
  source: {
    type: 'screen' | 'window'
    id: string
    fixedCanvas: { width: number; height: number }
    windowGeometry?: WindowGeometrySample[]
  }
  video: VideoInfo
  mouseTrack: Array<[number, number, number]>
  clicks: ClickEvent[]
  keys: KeyEvent[]
}
```

- `fixedCanvas` 对窗口录制取开始时窗口所在显示器的物理像素尺寸，偶数化后写入视频元信息。
- `windowGeometry` 使用与全局输入事件一致的屏幕坐标系；采样目标 60Hz，几何未变化时去重；变化样本前补旧 bounds 保持点，避免静止区间被线性插值成提前漂移。
- 时间点坐标换算使用相邻 geometry 样本插值；点击超出当时窗口 bounds 时不生成波纹或自动运镜。
- 来源在固定画布中的 placement 由共享纯函数按宽高比等比居中计算，预览与导出只消费归一化后的固定画布视频。

## 3. Data Flow & Interaction

1. 用户选中窗口并建立捕获流；Main 根据 source id 查询窗口所在显示器和原生窗口句柄/窗口号。
2. prepare 阶段探测窗口显示器并冻结 `fixedCanvas`；Renderer 把原始视频轨交给归一化 Worker，同时准备视频、麦克风与兜底系统音频 MediaRecorder。
3. Worker 对每个 VideoFrame 清空固定画布，按当前帧宽高比等比居中绘制，保持原时间戳并写入生成轨；MediaRecorder 只接收该恒定尺寸轨。
4. 各 MediaRecorder 启动后调用 activate IPC；Main 此时才建立统一 `t0`，启动正式 geometry helper、输入轮询/钩子及原生系统音频。helper 按相对时间输出窗口 bounds，Main 去重并在停止时写入 `events.json` V2。
5. 会话加载时，V2 的点击/轨迹通过 `geometryAt(t)` 和固定画布 placement 映射；关键帧、跟随与波纹共用同一纯函数。
6. 窗口跨显示器移动时画布仍保持开始显示器物理尺寸；仅 geometry 与来源 placement 更新。

## 4. Error Handling

- **helper 不存在/启动失败**：记录可诊断警告，窗口录制继续；V2 标记无 geometry，渲染安全退回旧显示器换算。
- **窗口临时无 bounds**：短时沿用最近有效样本；持续失效且捕获轨结束时复用现有 `SOURCE_LOST` 流程。
- **窗口最小化或尺寸为 0**：Worker 重复最后有效画面或绘制背景，不产生非法尺寸和 NaN 坐标。
- **MediaStreamTrack 无法进入 Worker**：Chromium 不允许采集轨 transfer/clone 时（实机已遇到 `Value does not have a transferable type`），降级为主线程隐藏 `<video>` + 固定 `<canvas>` + `captureStream(0)` 手动帧管线（`src/recorder/fixedCanvasMainThread.ts`），功能等价；`MediaStreamTrackProcessor`/`VideoTrackGenerator` 仅暴露于 DedicatedWorker，主线程预检不可依赖。
- **Worker/生成轨与主线程降级均不可用**：开始录制前明确提示固定画布不可用并中止窗口录制；整屏录制不受影响。
- **处理速度不足**：依赖 Stream 背压丢弃过期待处理帧而非无限堆积；输出时间戳保持单调。
- **旧会话**：V1 原样可读，不伪造窗口几何；现有显示器换算行为保持兼容。
