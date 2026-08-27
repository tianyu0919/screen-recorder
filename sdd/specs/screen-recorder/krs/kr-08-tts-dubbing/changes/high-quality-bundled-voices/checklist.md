# Verification Checklist: 高质量内置中英文 TTS 音色

> 全部通过后才允许把本 change 标记为 completed。

## Functional Verification

- [ ] 离线环境能看到并试听至少一个中英双语、一个中文专用、一个英文专用内置音色
- [ ] 三类音色都能完成字幕分段生成、缓存命中重组装、取消和失败恢复
- [ ] 三类音色生成后普通预览、专注预览与 MP4 导出听感和时间轴一致
- [x] Melo、Theresa、Fanchen 不再出现在 `ttsModels.json`、配音 UI、官方模型目录、构建资源或下载服务中
- [x] 旧 voiceId 不做迁移且不能重新生成；实现不会主动删除工作区外的旧会话目录
- [ ] 用户自定义 VITS 模型导入仍能探测、登记、试听和生成

## Audio Quality

- [ ] 固定中文语料覆盖多音字、数字、日期、英文缩写、长短句和连续标点，精选音色无人耳可闻电音、爆音、重复或漏读
- [ ] 固定英文语料覆盖数字、日期、缩写、专有名词、长短句和连续标点，精选音色无人耳可闻电音、爆音、重复或漏读
- [x] 22.05kHz 与 24kHz 输入经带限重采样到 48kHz 后，时长误差不超过一个输出采样帧；12kHz→16kHz 混叠回归 RMS=0.000774
- [ ] 所有段首、段尾和下一段截断边界经过淡化，数据级无单样本硬跳变；可闻 click/pop 待人耳抽听
- [ ] 1.05x、1.2x WSOLA 数据测试基频保持在 440.33/439.57Hz 且无越界/NaN；颤音或重复音节待人耳抽听
- [ ] 30 分钟派生轨继续严格等长，片尾声画误差不超过 20ms

## Packaging & Cross-platform

- [ ] macOS 安装包包含三套完整模型与可启动 helper；无网络生成通过
- [ ] Windows 安装包包含三套完整模型与可启动 helper；无网络生成通过
- [ ] `LENZA_REQUIRE_TTS_HELPER=1` 下删除任一必需模型文件会让构建明确失败
- [ ] macOS 与 Windows 使用相同模型、sid、文本和 speed 时输出时长误差小于 1ms

## Code Quality

- [x] `npm run typecheck` 通过
- [x] lint 与 build 通过且无新增告警
- [x] 单文件不超过 300 行；模型族分发与平台分发职责分离
- [x] 无调试日志、注释代码、旧官方音色死分支或未使用下载依赖残留

## Documentation

- [x] `docs/TECH_DESIGN.md` 记录三套模型、模型族配置、资源路径、音频质量处理及 Matcha 许可限制
- [x] kr-08 主 spec/tasks/checklist 与 `sdd/project.md` 同步当前状态和范围
