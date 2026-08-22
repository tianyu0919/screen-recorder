# Verification Checklist: 自定义音轨

## Functional Verification
- [x] 添加音频文件后时间轴出现波形块、检查器出现条目（代码路径：addCustomClip → AudioClipsLayer）
- [ ] 对话框取消无副作用；损坏文件给出友好提示（人工确认）
- [ ] 波形块可拖动（不触发 seek），松手后位置固定（人工确认）
- [ ] 预览：区间内发声、区间外静音、seek 后对齐（人工确认）
- [ ] 导出：clip 位置/电平与预览一致，裁剪后仍对齐（人工确认）
- [x] 长音频导入后止于真实视频片尾，波形和导出均不越界（纯逻辑 smoke）
- [ ] 波形左右边缘可裁掉音频头尾，主体仍可拖动定位，最短保留 100ms
- [x] 波形横向滚动可滑移原音频播放区间，offsetMs 与片段长度保持不变
- [x] 波形纵向滚动继续缩放时间轴，横纵方向判断兼容 Windows 滚轮和 macOS 触控板
- [x] 滑移时波形与素材起止时间实时更新，边界钳制正确并进入自动保存
- [x] 片尾外点击/按键不显示，且不会生成片尾缩放或点击波纹（27s 边界 smoke）
- [x] 合法音频不会因 decodeAudioData detach buffer 而添加失败；超大文件错误可见（代码路径）
- [x] 既有功能无回归：`export.smoke.ts` 混音/游标全部用例通过（2026-08-22）

## Code Quality
- [x] `npm run typecheck` 通过（2026-08-22）
- [x] `npm run build` 通过（2026-08-22）
- [x] `tsx scripts/export.smoke.ts` 通过（2026-08-22）
- [x] `scripts/audio-clip.smoke.ts` 片尾/裁剪专项全部通过（2026-08-22）

## Non-Functional
- [x] PCM 进 worker 用结构化克隆（不用 transfer），缓存保留可重复导出
- [x] 连续播放不通过 timeupdate 反复 seek 自定义音轨，只在播放/跳转/片段边界调度
- [x] 播放头更新不重新计算音频波形 SVG、事件点和运镜片段 DOM
- [x] 性能优化不改变 clip 裁剪、定位、音量和导出数据
- [x] 预览 WebGL backing 最高 1280×720 且按舞台尺寸分档，上传纹理长边限制为 backing 的 1.5 倍；导出仍为 1920×1080
- [x] 自定义音轨复用首次解码的 AudioBuffer，所有 clip 共用一个 AudioContext
- [x] RenderInfo 仅变化时更新；播放头逐帧位置直接写 DOM，React 时间 UI 降频
- [ ] [P2 暂缓] 导入音频后连续播放，视频画面与时间轴播放头在 Windows 实机上保持流畅
- [ ] 手动冒烟：Windows 平台（待人工）
