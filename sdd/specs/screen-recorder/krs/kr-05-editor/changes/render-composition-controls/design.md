# Design: 运镜、静音与背景画布控制 (Design)

## 1. Architecture

```text
edit.json V2 ──> previewStore
  ├─ motionEnabled ──> 运镜检查器 / 时间轴可编辑态 / keyframe 派生
  ├─ audioMute ──────> 预览 GainNode / 导出混音 effectiveGain
  └─ renderSettings ─> 输出尺寸解析 ─> 预览 Compositor / 导出 Worker

source metadata ──> resolveOutputPlan(settings, encoder limits)
  ├─ background OFF: 源尺寸（必要时等比降档）
  └─ background ON : 1920×1080 + 纯色背景 + 等比居中内容
```

预览和导出 SHALL 共用纯函数输出计划与合成配置，避免两条管线分别解释背景、尺寸和画面摆放。

## 2. Data Model & Interfaces

```typescript
interface EditDocumentV2 {
  version: 2
  motionEnabled: boolean
  audioGain: { mic: number; system: number }
  audioMute: { mic: boolean; system: boolean }
  customAudio: PersistedAudioClipV2[]
  renderSettings: {
    backgroundEnabled: boolean
    backgroundColor: string // normalized #RRGGBB
  }
  // V1 既有字段保持
}

interface PersistedAudioClipV2 extends PersistedAudioClipV1 {
  muted: boolean
}

interface OutputPlan {
  width: number
  height: number
  sourceRect: { x: number; y: number; width: number; height: number }
  backgroundEnabled: boolean
  backgroundColor: string
  downscaled: boolean
}
```

V1 → V2 默认迁移：`motionEnabled=true`、所有 `muted=false`、`backgroundEnabled=false`、`backgroundColor=#16181D`。缺失或非法 HEX 使用默认色；合法颜色统一为大写 `#RRGGBB`。

`effectiveGain = muted ? 0 : gain`。静音操作不得修改 gain。关闭运镜不得修改 `motionEffects` 或 `motionParams`。

## 3. Data Flow & Interaction

1. 用户切换运镜：store 只更新 `motionEnabled`。关闭时关键帧派生返回全局 1.0x 视图；波纹和键盘层继续从事件/效果派生。时间轴保留运镜块，以弱化样式展示并阻止新增、拖拽、拉伸、删除和倍率修改。
2. 用户点击静音：只翻转对应 mute 位；预览音频立即使用 effectiveGain，导出消息携带相同有效值；再次点击恢复原 gain。
3. 用户关闭背景：读取视频 metadata，输出计划使用源宽高；源内容从 `(0,0)` 填满画布，不加 padding、圆角、阴影或额外背景图层。
4. 用户开启背景：输出固定 1920×1080，源画面保持比例居中，按既有视觉留白规则缩放；空余区域绘制纯色。
5. 用户选色：预设色、系统颜色输入和 HEX 输入写入同一 `backgroundColor`；输入未完成时保留本地草稿，合法后才提交 store。
6. 导出前以目标尺寸探测编码器。若不支持，按设备可用上限逐级等比缩小到偶数宽高，再用最终尺寸创建画布、VideoEncoder 和 muxer；界面显示“实际输出 W×H”。

## 4. Error Handling

- 视频 metadata 未就绪：预览暂用安全占位尺寸，导出阻止开始并提示无法读取源尺寸。
- HEX 非法：不更新持久化颜色，输入框显示错误状态；失焦恢复最后合法值。
- 编码器不支持目标尺寸：自动等比降档；仍找不到可用配置时沿用现有 WebM/ffmpeg fallback，并显示原因。
- 单边尺寸为奇数：输出计划向下归一为最接近的正偶数，保持宽高比误差最小。
- 历史或部分损坏 edit.json：逐字段使用迁移默认值，不阻断会话打开。
- 静音轨道 PCM 缺失：按既有规则跳过该轨；不得因 mute 状态引入额外失败。
