# Task Breakdown & Execution Board: 编辑器舞台自适应与检查器收起

## Phase 1: 舞台尺寸计算
- [x] Task 1.1: 新增 `useStageFit`，用 ResizeObserver 计算适应模式下的精确 CSS 宽高
- [x] Task 1.2: 为适应/100% 模式定义类型与纯尺寸计算函数

## Phase 2: 预览缩放交互
- [x] Task 2.1: PreviewPlayer 接入显式 Canvas 尺寸，移除不稳定的 max-width/max-height 组合
- [x] Task 2.2: 增加“适应 / 100%”切换；100% 模式启用舞台滚动

## Phase 3: 检查器布局
- [x] Task 3.1: PreviewScreen 工具栏增加检查器收起/展开按钮
- [x] Task 3.2: 检查器隐藏后释放布局宽度，并触发舞台 ResizeObserver 重算

## Phase 4: 验证
- [x] Task 4.1: 添加舞台 fit 纯逻辑 smoke 测试
- [x] Task 4.2: 运行 typecheck、build 和既有回归冒烟
- [x] Task 4.3: Windows 手动拖动窗口、切换 100%、收起检查器冒烟

# Task Dependencies
- [Task 1.1] depends on [Task 1.2]
- [Task 2.1] and [Task 2.2] depend on [Task 1.1]
- [Task 3.2] depends on [Task 3.1] and [Task 2.1]
- [Task 4.1] depends on [Task 1.2]
- [Task 4.2] and [Task 4.3] depend on [Task 2.1] through [Task 3.2]
