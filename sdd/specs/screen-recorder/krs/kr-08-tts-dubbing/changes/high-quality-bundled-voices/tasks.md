# Task Breakdown & Execution Board: 高质量内置中英文 TTS 音色

> 按依赖顺序执行；完成一项后勾选。实现前须由用户批准本变更 spec。

## Phase 1: 模型与运行时验证

- [x] Task 1.1: 下载并校验 Kokoro v1.1 int8 中英、Matcha 中文 + Vocos、Kokoro English v0.19，记录官方文件大小、SHA-1 与许可证（Matcha Baker 训练数据仅限非商业使用，已写入设计风险）
- [x] Task 1.2: 用当前 sherpa-onnx 1.12.20 对三套模型完成 macOS C API PoC；无需升级运行时
- [ ] Task 1.3: 用固定中英质量语料批量生成候选 sid，人工筛选最终内置中英、中文、英文音色集合

## Phase 2: 模型清单与 helper

- [x] Task 2.1: 扩展 `shared/ttsModels.json`/解析类型支持 kokoro、matcha、vits 模型族与多文件摘要
- [x] Task 2.2: 扩展 `native/tts-helper` 启动参数与配置分发，按模型族创建 sherpa-onnx OfflineTts，保持逐段 JSON 协议不变
- [x] Task 2.3: 更新模型获取脚本，把三套目标模型全部纳入 `build:native`；删除 Melo、Theresa、Fanchen 官方资源与下载清单
- [x] Task 2.4: 调整 Main 模型管理：官方音色全部内置可用，移除官方下载服务和 IPC/UI 分支，保留自定义 VITS 导入

## Phase 3: 派生音频质量

- [x] Task 3.1: 在 `shared/ttsPcm.ts` 用确定性带限算法替换线性重采样，并完成 22.05/24/48kHz 时长与混叠数据回归
- [x] Task 3.2: 修正 WSOLA 的归一化相关、搜索边界与短段降级，完成 1.0x、1.05x、1.2x 基频/长度/有限值测试
- [x] Task 3.3: 为段首、段尾及截断点加入 8ms 淡入淡出，验证派生轨边界归零且保持严格等长

## Phase 4: UI、分发与文档

- [x] Task 4.1: 配音面板按中英双语、中文专用、英文专用展示候选音色，删除旧音色与官方下载交互
- [x] Task 4.2: 更新 electron-builder、release workflow 与强制资源检查，确保三套模型在 macOS/Windows 安装包内路径一致
- [x] Task 4.3: 更新 `docs/TECH_DESIGN.md`、kr-08 主 spec/tasks/checklist 与 `sdd/project.md` 的最终模型和音频质量口径

## Phase 5: 验证

- [x] Task 5.1: 运行模型摘要/helper/PCM 数据测试、`npm run typecheck`、lint 与 build
- [ ] Task 5.2: macOS 对三类模型完成试听、生成、增量重生成、热切换、预览与 MP4 导出冒烟
- [ ] Task 5.3: Windows 对三类模型完成等价冒烟，并核对同文本输出时长与安装资源完整性
- [ ] Task 5.4: 逐项关闭 `checklist.md`，全部通过后将本 change 与 kr-08 状态同步更新

# Task Dependencies

- [Task 1.2] depends on [Task 1.1]
- [Task 1.3] depends on [Task 1.2]
- [Task 2.1] depends on [Task 1.1]
- [Task 2.2] depends on [Task 1.2] and [Task 2.1]
- [Task 2.3] depends on [Task 2.1]
- [Task 2.4] depends on [Task 2.1] and [Task 2.2]
- [Task 3.2] depends on [Task 1.3]
- [Task 3.3] depends on [Task 3.1] and [Task 3.2]
- [Task 4.1] depends on [Task 2.4]
- [Task 4.2] depends on [Task 2.2] and [Task 2.3]
- [Task 4.3] depends on [Task 2.4], [Task 3.3], and [Task 4.2]
- [Task 5.1] depends on [Task 3.3] and [Task 4.3]
- [Task 5.2] and [Task 5.3] depend on [Task 5.1] and can run in parallel
- [Task 2.3] and [Phase 3] can run in parallel after their respective dependencies
