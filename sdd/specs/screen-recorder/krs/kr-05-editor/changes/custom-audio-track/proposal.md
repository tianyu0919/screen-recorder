# Proposal: 自定义音轨（波形 + 拖拽定位）(Proposal)

## 1. Context & Problem Statement
- **Current State**: 编辑器只有录制期采集的 mic/system 两条音轨（音量可调），无法添加外部音频。
- **Pain Points**: 用户想给录屏配背景音乐/旁白素材时无能为力；且音轨位置不可视、不可调，
  不符合视频编辑软件的基本心智（看到波形、按住拖动对齐画面）。

## 2. Value Proposition
- 录屏可直接配 BGM/旁白，闭环在应用内完成，不用再导出去别的剪辑软件。
- 波形可视 + 拖拽定位让"声音对准画面"零成本。

## 3. Alternatives Considered
- **Option A**: 预览/导出都实时解码原始文件（Cons: 预览与导出可能解码结果漂移；worker 无 decodeAudioData，需双实现）
- **Option B**: Renderer 一次解码，缓存 AudioBuffer 供 Web Audio 预览、缓存 PCM 供 worker 导出（选定：不重复解码压缩源，预览/导出共用同一份解码内容；内存代价可接受）
- **Option C**: clip 锚定输出时间轴（Cons: 裁剪后音画错位；选定锚定源时间轴，与 mic/system 一起经 cutPcm 映射）

## 4. Success Metrics
- [ ] 添加 mp3/wav/m4a 后时间轴出现波形块，可拖动且预览/导出听感一致
- [ ] 与裁剪/音量功能正交无回归
