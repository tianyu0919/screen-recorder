# Task Breakdown & Execution Board: 多轨音频时间线与片段裁剪

## Phase 1: 编辑契约与迁移

- [ ] Task 1.1: 定义 `EditDocumentV2` 的音轨/片段模型、轨道与片段操作纯函数及 shared 契约。
- [ ] Task 1.2: 实现 V1 扁平 `customAudio` 到 V2 多轨结构的无损迁移、宽松校验和失败回退。
- [ ] Task 1.3: 扩展自动保存、会话资产恢复与导出快照，保持既有 edit.json 原子写入语义。

## Phase 2: 时间线模型与交互

- [ ] Task 2.1: 实现轨道创建、重命名、排序、删除、增益和静音操作，以及同轨不重叠约束。
- [ ] Task 2.2: 实现片段新增、水平定位、跨轨移动、冲突吸附、双端裁剪和删除纯逻辑。
- [ ] Task 2.3: 重构时间线为录制音频固定行 + 自定义音轨列表，保持轨道头与滚动内容对齐。
- [ ] Task 2.4: 接入片段波形、选择态、拖动/裁剪手柄、冲突反馈与非空轨删除确认。

## Phase 3: 预览、导出与性能

- [ ] Task 3.1: 按轨道增益/静音和片段增益调度单一 AudioContext，处理 seek、片段边界和资产缺失。
- [ ] Task 3.2: 将多轨快照展开到现有 `mixTracks` 导出链路，验证裁剪、重叠轨道和防削波。
- [ ] Task 3.3: 对波形做可视区降级，保持播放头命令式更新，避免逐帧全轨 React 重渲染。

## Phase 4: 验证与文档

- [ ] Task 4.1: 增加 V1→V2 迁移、轨道冲突、跨轨移动、裁剪和混音专项 smoke。
- [ ] Task 4.2: 运行 lint、typecheck、build、timeline/audio/export smoke，并同步 `docs/TECH_DESIGN.md`。
- [ ] Task 4.3: 在 macOS/Windows 冒烟至少 5 轨 20 片段的添加、裁剪、保存恢复、预览和导出。

# Task Dependencies

- [Task 1.2] depends on [Task 1.1].
- [Task 1.3] depends on [Task 1.1] and [Task 1.2].
- [Task 2.1] and [Task 2.2] depend on [Task 1.1] and can run in parallel.
- [Task 2.3] depends on [Task 2.1].
- [Task 2.4] depends on [Task 2.2] and [Task 2.3].
- [Task 3.1] and [Task 3.2] depend on [Task 1.3], [Task 2.1] and [Task 2.2] and can run in parallel.
- [Task 3.3] depends on [Task 2.3] and [Task 2.4].
- [Task 4.1] depends on [Task 1.2], [Task 2.2], [Task 3.1] and [Task 3.2].
- [Task 4.2] depends on [Task 3.3] and [Task 4.1].
- [Task 4.3] depends on [Task 4.2].
