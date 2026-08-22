# Task Breakdown & Execution Board: 可编辑运镜、事件与自动保存 (Tasks)

## Phase 1: 编辑契约与纯模型
- [x] Task 1.1: 定义版本化 `EditDocumentV1`、`MotionEffect`、`KeyPrompt`、持久化音频与保存状态类型
- [x] Task 1.2: 定义读取/保存编辑文档和复制/删除会话音频资产的 shared IPC 契约
- [x] Task 1.3: 实现 edit.json 宽松校验、默认迁移与序列化纯函数

## Phase 2: 运镜与事件派生
- [x] Task 2.1: 实现运镜新增/移动/双端调整的 300ms、100ms 吸附、边界和不可重叠约束
- [x] Task 2.2: 将点击派生为稳定关联效果组，支持移动/删除波纹覆盖及编辑时间鼠标坐标采样
- [x] Task 2.3: 将跟随安全区从中央 60% 改为中央 40%，补倍率、边缘和空轨迹回归
- [x] Task 2.4: 实现键盘隐私过滤、修饰键组合、功能键白名单、历史事件兼容和重复限流
- [x] Task 2.5: 实现事件密度分档、像素聚合、Tooltip 数据和可视窗口计算纯函数
- [x] Task 2.6: 移除放大跟随百分比安全区，降低采样与像素去抖阈值，并为跟随目标使用轻量快速平滑

## Phase 3: Main 持久化与采集
- [x] Task 3.1: Main 原子读取/写入 edit.json，返回 updatedAt 并处理损坏/版本不兼容降级
- [x] Task 3.2: 自定义音频导入后复制到会话资产目录，加载时恢复并处理资产缺失
- [x] Task 3.3: uiohook 增加 modifier/key-up 状态，只落盘快捷键、功能键和单独修饰键
- [x] Task 3.4: 会话列表读取最近编辑时间并按编辑优先、录制时间兜底排序

## Phase 4: Store 与自动保存
- [x] Task 4.1: previewStore 接入编辑文档、稳定 motion/key/audio 操作和统一派生管线
- [x] Task 4.2: 实现 revision 守卫、手势提交、500ms 防抖、失败保脏和点击重试的保存协调器
- [x] Task 4.3: exportStore 改为读取同一编辑快照，确保运镜/波纹/键盘/裁剪/音频一致

## Phase 5: 时间轴和检查器交互
- [x] Task 5.1: 新增无外部依赖的时间轴右键菜单，区分空白、运镜、事件和音频上下文
- [x] Task 5.2: 运镜块支持主体拖动、双端手柄、选中、删除和短块 Hover 详情
- [x] Task 5.3: 新增按键录入浮层，只接受合法快捷键/功能键并支持事件删除
- [x] Task 5.4: 事件轨接入密度档位、聚合圆点、Hover 列表和带缓冲的可视区虚拟化
- [x] Task 5.5: “添加音轨”从检查器移除，右键导入按目标时间定位；保留音量和删除管理
- [x] Task 5.6: 左上角增加保存中/已保存淡出/失败重试状态，会话卡增加最近编辑时间

## Phase 6: 按键提示渲染
- [x] Task 6.1: 实现按键提示布局、1.5 秒替换与淡入淡出纯函数和位图渲染器
- [x] Task 6.2: 预览舞台增加按键提示选择框与全局位置拖动，逐帧数据不进入 React state
- [x] Task 6.3: Compositor 和导出 Worker 接入同一按键提示纹理、位置及时间查询

## Phase 7: 验证与文档
- [x] Task 7.1: 增加运镜约束/关联、键盘过滤、事件 LOD、编辑文档迁移和保存 revision smoke
- [x] Task 7.2: 运行 typecheck、build、timeline/render/export/audio smoke，检查相关文件不超过 300 行
- [x] Task 7.3: 同步 TECH_DESIGN、kr-02 跟随变更及 edit.json/采集语义文档
- [x] Task 7.6: 更新即时跟随专项回归并运行 lint、typecheck、build、timeline/render/export/audio/cursor-follow smoke
- [ ] Task 7.4: Windows 人工冒烟：长会话缩放、播放中虚拟化、运镜手势、右键添加、保存恢复和 MP4 一致性
- [ ] Task 7.5: macOS 人工冒烟：全局键盘过滤/组合、上下文菜单、保存恢复和 MP4 一致性

# Task Dependencies
- [Task 1.3] depends on [Task 1.1]
- [Task 2.1], [Task 2.2], [Task 2.4] and [Task 2.5] depend on [Task 1.1] and can run in parallel
- [Task 2.3] depends on [Task 2.2]
- [Task 2.6] depends on [Task 2.3]
- [Task 3.1] depends on [Task 1.2] and [Task 1.3]
- [Task 3.2] depends on [Task 1.2]
- [Task 3.3] depends on [Task 2.4]
- [Task 3.4] depends on [Task 3.1]
- [Task 4.1] depends on [Task 2.1], [Task 2.2], [Task 2.4] and [Task 3.1]
- [Task 4.2] depends on [Task 3.1] and [Task 4.1]
- [Task 4.3] depends on [Task 3.2] and [Task 4.1]
- [Task 5.1], [Task 5.2], [Task 5.3] and [Task 5.4] depend on [Task 4.1]
- [Task 5.5] depends on [Task 3.2], [Task 4.1] and [Task 5.1]
- [Task 5.6] depends on [Task 3.4] and [Task 4.2]
- [Task 6.1] depends on [Task 2.4]
- [Task 6.2] and [Task 6.3] depend on [Task 4.1] and [Task 6.1] and can run in parallel
- [Task 7.1] depends on [Task 2.1] through [Task 6.3]
- [Task 7.2] through [Task 7.5] depend on [Task 7.1]
- [Task 7.6] depends on [Task 2.6]
