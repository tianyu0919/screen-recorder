# Task Breakdown & Execution Board: 运镜、静音与背景画布控制 (Tasks)

## Phase 1: 契约与纯逻辑
- [x] Task 1.1: 将 edit.json 升级为 V2，增加运镜开关、mic/system mute、custom clip muted 与背景设置，并实现 V1 安全迁移
- [x] Task 1.2: 增加 HEX 校验/规范化与 `resolveOutputPlan` 纯函数，覆盖源尺寸、固定画布、偶数归一和等比降档
- [x] Task 1.3: 扩展 previewStore、自动保存快照与恢复流程，确保开关不破坏既有运镜参数和音量

## Phase 2: 运镜与音频语义
- [x] Task 2.1: 运镜关闭时派生 1.0x 全局视图，同时保留点击波纹和键盘提示
- [x] Task 2.2: 运镜时间轴接入禁用样式与所有编辑入口守卫；全局/单段倍率下限改为 1.0x
- [x] Task 2.3: mic/system/custom 音频接入独立 mute 状态，预览和导出统一使用 effectiveGain

## Phase 3: 合成与导出
- [x] Task 3.1: 重构共享渲染配置，移除强制渐变、圆角和阴影，按 OutputPlan 绘制源内容
- [x] Task 3.2: 预览舞台按动态输出比例适配，并展示计划/实际输出尺寸及降档提示
- [x] Task 3.3: 导出 Worker、VideoEncoder 与 muxer 改用动态尺寸，增加能力探测和最大可用等比降档

## Phase 4: 检查器 UI
- [x] Task 4.1: 运镜区增加 Switch 和渐进披露动效，补全键盘操作、焦点态与禁用说明
- [x] Task 4.2: 音频行增加静音/恢复按钮，保持滑杆位置并提供可访问名称和状态
- [x] Task 4.3: 新增背景图层面板，提供 Switch、预设色、原生颜色输入、HEX 输入与错误反馈

## Phase 5: 验证与文档
- [x] Task 5.1: 增加 edit V1→V2、输出计划、颜色、禁用运镜和 effectiveGain 的纯逻辑回归
- [x] Task 5.2: 运行 `npm run typecheck`、`npm run build` 及相关 export/audio smoke
- [ ] Task 5.3: 人工冒烟运镜切换、三类静音、非 16:9 源、背景色、超限降档与预览/导出一致性
- [x] Task 5.4: 同步 `docs/TECH_DESIGN.md` 的 edit.json、渲染管线与动态导出尺寸说明

# Task Dependencies
- [Task 1.3] depends on [Task 1.1] and [Task 1.2]
- [Task 2.1], [Task 2.2] and [Task 2.3] depend on [Task 1.3]
- [Task 3.1] depends on [Task 1.2] and [Task 1.3]
- [Task 3.2] depends on [Task 3.1]
- [Task 3.3] depends on [Task 3.1]
- [Task 4.1] depends on [Task 2.1] and [Task 2.2]
- [Task 4.2] depends on [Task 2.3]
- [Task 4.3] depends on [Task 1.2] and [Task 1.3]
- [Task 3.x] and [Task 4.x] can run in parallel after their Phase 1/2 dependencies
- [Task 5.1] depends on [Task 1.x] through [Task 3.x]
- [Task 5.2], [Task 5.3] and [Task 5.4] depend on all implementation tasks
