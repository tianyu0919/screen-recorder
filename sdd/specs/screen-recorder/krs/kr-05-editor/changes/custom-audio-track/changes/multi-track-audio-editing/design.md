# Design: 多轨音频时间线与片段裁剪

## 1. Architecture

```text
时间线
├─ 录制音频（mic/system，只读波形与既有分轨增益）
└─ 自定义音轨列表
   ├─ 轨道头：名称 / 音量 / 静音 / 删除
   └─ 片段区：多个 AudioClip（波形、拖动、双端裁剪、跨轨移动）

EditDocumentV2
  └─ customAudioTracks[] → clips[] → 会话资产引用
       ├─ 预览：单 AudioContext 按视频时钟调度所有可听片段
       └─ 导出：按轨增益/静音展开为 PCM，再复用 mixTracks
```

## 2. Data Model & Interfaces

```typescript
interface PersistedAudioTrack {
  id: string
  name: string
  gain: number
  muted: boolean
  clips: PersistedAudioClip[]
}

interface PersistedAudioClip {
  id: string
  assetPath: string
  name: string
  offsetMs: number
  trimStartMs: number
  trimEndMs: number
  gain: number
}
```

- `EditDocumentV2` 使用 `customAudioTracks` 替代 V1 的扁平 `customAudio`。
- 读取 V1 时按时间冲突自动分配到最少数量的轨道，保证所有旧片段位置、裁剪和增益不变；成功保存后写为 V2。
- 同一轨道的片段不得重叠。拖动产生冲突时显示冲突态并吸附至最近合法位置；用户可拖至另一轨道解决。
- PCM 与 `AudioBuffer` 继续存放在模块缓存，不进入 zustand 或编辑文档。

## 3. Data Flow & Interaction

1. 用户点击“+ 音轨”创建空轨，或在目标轨右键/按钮选择“添加音频”。
2. 导入成功后创建片段并放入目标轨的播放头位置；空间不足时吸附到最近合法区间。
3. 水平拖动改变 `offsetMs`，垂直越过轨道中线时切换目标轨；拖动期间只更新必要的交互状态，结束后提交并自动保存。
4. 左右手柄修改 `trimStartMs` / `trimEndMs`，最短片段保持 100ms，波形实时裁切。
5. 轨道增益与静音和片段增益相乘；预览和导出展开同一份轨道快照。
6. 删除非空轨道必须二次确认；确认后删除轨道及其中片段引用，资产清理由既有会话资产策略处理。

## 4. Error Handling

- V1 迁移失败时保留原文档并回退到扁平兼容展示，不覆盖磁盘文件。
- 音频资产缺失时仅禁用对应片段并显示错误，不阻断其他轨道播放和导出。
- 拖动或裁剪冲突时保持上一次合法值，不产生重叠或负时长片段。
- 保存失败沿用既有“保存失败 · 点击重试”，内存编辑不丢失。
- 轨道或片段数量较多时，仅渲染可视时间范围内的波形细节，播放头仍走命令式更新。
