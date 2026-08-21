# Task Breakdown & Execution Board: 自定义音轨 (Tasks)

## Phase 1: 文件选择与解码
- [x] Task 1.1: IPC `audio:pick-file`（shared/ipc + electron/ipc dialog+读文件 + preload 白名单）
- [x] Task 1.2: `src/lib/audioFile.ts`：decodeAudioData → WavData + computePeaks（~200 桶峰值包络）

## Phase 2: 状态与缓存
- [x] Task 2.1: `src/export/clipCache.ts` 模块级 PCM/AudioBuffer 缓存
- [x] Task 2.2: previewStore：`customClips` + addCustomClip / removeCustomClip / setClipOffset / setClipGain（切换会话清空）

## Phase 3: 时间轴 UI
- [x] Task 3.1: PlayerTimeline 增加「音频」行（容器加高 168→216）+ AudioClipsLayer 波形块（SVG 峰值）
- [x] Task 3.2: 波形块 pointer 拖拽改 offsetMs（stopPropagation 不触发 seek；clamp [0, 片尾-clip]）

## Phase 4: 预览与导出
- [x] Task 4.1: `useClipsAudio`：按 video 区间调度自定义 clip（增益实时）
- [x] Task 4.2: `mixTracks` 泛化混音（mixPcm 保留为包装）；messages/exportStore/pipeline 贯通

## Phase 5: 验证
- [x] Task 5.1: `npm run typecheck` + `npm run build` + `tsx scripts/export.smoke.ts` 回归全部通过（2026-08-22）
- [ ] Task 5.2: 人工冒烟：添加 BGM → 波形出现 → 拖动 → 预览/导出一致

## Phase 6: 片尾约束与音轨裁剪
- [x] Task 6.1: 真实视频时长写回 store，过滤片尾外事件并重新派生运镜/波纹
- [x] Task 6.2: CustomClip 增加原音频时长与 trim 区间，长音频导入时钳制到片尾
- [x] Task 6.3: AudioClipsLayer 增加左右拖边裁剪，波形只显示保留区间
- [x] Task 6.4: 预览与导出应用相同 trim 区间，混音 PCM 截断到真实视频片尾
- [x] Task 6.5: 修复 decodeAudioData buffer detach 与文件选择异常提示
- [x] Task 6.6: 补充纯逻辑回归并运行 typecheck / build / export smoke

## Phase 7: 播放性能修复
- [x] Task 7.1: 调整自定义音轨同步策略，降低播放中的重复 seek
- [x] Task 7.2: 缓存波形路径与时间轴派生数据，隔离静态轨道和逐帧播放头更新
- [x] Task 7.3: 补充同步阈值回归并运行 typecheck / build / smoke
- [x] Task 7.4: 实机反馈仍卡顿，移除 timeupdate 漂移 seek，改为片段边界调度并完成自动回归

## Phase 8: 实机卡顿二次修复（P2，暂缓）
- [x] Task 8.1: 预览合成按舞台显示尺寸降档并限制上传纹理，导出仍保持 1920×1080
- [x] Task 8.2: RenderInfo 改为变化时更新，播放头逐帧位置改为命令式 DOM 更新
- [x] Task 8.3: 自定义音轨复用 decodeAudioData 的 AudioBuffer，由单一 Web Audio 上下文调度
- [x] Task 8.4: 预览尺寸/纹理、音轨裁剪与导出回归通过；typecheck / build / smoke 全部通过（2026-08-22）
- [ ] Task 8.5 [P2]: Windows 实机仍有轻微卡顿，后续继续采样性能轨迹并优化

# Task Dependencies
- [Task 2.2] depends on [Task 1.1] and [Task 1.2]
- [Task 3.1] depends on [Task 2.2]
- [Task 3.2] depends on [Task 3.1]
- [Task 4.1] depends on [Task 2.2]
- [Task 4.2] depends on [Task 2.1]
- [Task 3.x] and [Task 4.x] can run in parallel after Phase 2
- [Task 6.2] depends on [Task 6.1]
- [Task 6.3], [Task 6.4] and [Task 6.5] can run in parallel after [Task 6.2]
- [Task 6.6] depends on [Task 6.1] through [Task 6.5]
- [Task 7.2] can run in parallel with [Task 7.1]
- [Task 7.3] depends on [Task 7.1] and [Task 7.2]
- [Task 8.1] and [Task 8.3] can run in parallel
- [Task 8.2] depends on [Task 8.1]
- [Task 8.4] depends on [Task 8.1] through [Task 8.3]
- [Task 8.5] depends on [Task 8.4]
