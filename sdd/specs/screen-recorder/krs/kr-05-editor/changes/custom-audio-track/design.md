# Design: 自定义音轨（波形 + 拖拽定位）(Design)

## 1. Architecture

```
Renderer: 检查器「音频」区 [添加音轨] → IPC 选文件 → decodeAudioData →
          previewStore.customClips（元数据+波形峰值） + clipCache（PCM/AudioBuffer，模块级）
              ├─ 时间轴：波形块主体移动；左右边缘改 trimStartMs / trimEndMs
              ├─ 预览：单一 AudioContext 按 video.currentTime + trimStartMs 调度每条 clip
              └─ 导出：PCM 先按 trim 区间切片 → mixTracks → 按视频片尾截断 → cutPcm
Main:     audio:pick-file（dialog.showOpenDialog + 读文件返回 bytes）
```

## 2. Data Model & Interfaces

```typescript
// previewStore（内存态，不持久化；随 edit.json 计划后续纳入）
interface CustomClip {
  id: string
  name: string          // 文件名
  offsetMs: number      // 源时间轴上的起始位置（拖拽调整，clamp ≥ 0）
  gain: number          // 0–1（检查器滑杆）
  sourceDurationMs: number // 原音频总时长
  trimStartMs: number   // 原音频保留区间起点
  trimEndMs: number     // 原音频保留区间终点
  peaks: number[]       // 波形峰值包络（~200 桶，0–1 归一化，SVG 绘制）
}

// 模块级缓存（不进 zustand，避免大对象触发订阅）：src/export/clipCache.ts
//   Map<id, { wav: WavData; audioBuffer: AudioBuffer }>

// IPC：audio:pick-file → { name, path, data: ArrayBuffer } | null（取消）

// worker 消息扩展（ExportStartMessage）：
customAudio: Array<{ offsetMs: number; trimStartMs: number; trimEndMs: number;
                     gain: number; sampleRate: number;
                     channels: number; samples: ArrayBuffer /* Int16 PCM，transfer */ }>

// 混音泛化（export/audio.ts）：
mixTracks(tracks: Array<{ wav: WavData; offsetSec: number; gain: number }>): WavData | null
//   offsetSec 语义沿用 mixPcm：输出时刻 t 读取该轨 t + offsetSec 处采样
//   （clip 起始 offsetMs → offsetSec = -offsetMs/1000）
// mixPcm(a, b, off, gA, gB) 保留为 mixTracks 的包装（scripts/export.smoke.ts 不动）
```

## 3. Data Flow & Interaction
1. 用户点「添加音轨」→ Main 弹文件对话框 → 读 bytes 回 Renderer
2. `AudioContext.decodeAudioData` 只解码一次 → WavData + AudioBuffer + peaks 入缓存，clip 元数据进 store
3. 视频元数据给出真实时长后写回 previewStore；过滤片尾外事件并重算 keyframes/ripples，
   同时把自定义 clip 钳制在片尾内
4. 时间轴波形主体拖拽改 offsetMs；左右 8px 手柄分别调整 trimStartMs / trimEndMs
5. 预览：所有 clip 共用一个 `AudioContext`；播放/seek/速率变化时按视频时钟创建一次性
   `AudioBufferSourceNode`，本地播放位置为 `trimStartMs + (videoTime - offsetMs)`，
   `start(when, offset, duration)` 精确约束起止；逐帧路径不 seek
6. 导出：PCM 先切 `[trimStartMs, trimEndMs)`，再按 offsetMs 混入源时间轴；混音结果先按
   真实视频时长截断，再经 cutPcm 统一裁剪映射 → 编码进 muxer

## 4. Error Handling
- 文件对话框取消 → 返回 null，无副作用
- 解码失败（格式不支持/损坏）→ 由 store 捕获，检查器提示「无法解码该音频文件」
- 文件过大（>200MB）→ Main 侧拒绝并提示
- decodeAudioData 会 detach 输入 ArrayBuffer → 调用方不再复用原始 bytes，直接保留其返回的 AudioBuffer
- 导出时 clip PCM 缺失（缓存异常）→ 跳过该轨，不阻断导出
- 持久化缺失（重开会话 clips 丢失）→ 本期已知限制，spec 注明
