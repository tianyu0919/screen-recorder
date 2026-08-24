# Task Breakdown & Execution Board: 播放线拖动与裁剪区定位规则

## Phase 1: 定位规则

- [x] Task 1.1: 在 `src/timeline/cuts.ts` 增加单击拒绝与拖动边界吸附所需的纯函数

## Phase 2: 播放线交互

- [x] Task 2.1: 扩大整条播放线命中区，实现 pointer capture 拖动与实时 seek
- [x] Task 2.2: 拖动开始时记录播放状态并临时暂停，结束后按原状态恢复
- [x] Task 2.3: 时间轴普通单击复用裁剪区拒绝规则，并确保最左侧精确定位 `0ms`
- [x] Task 2.4: 已裁剪区移除原生 `title`，复用项目 shadcn Tooltip 展示悬浮说明

## Phase 3: 验证

- [x] Task 3.1: 运行 TypeScript、ESLint、生产构建及差异检查
- [x] Task 3.2: 按 `checklist.md` 完成可自动验证项并记录人工冒烟项

# Task Dependencies

- [Task 2.1] depends on [Task 1.1]
- [Task 2.2] depends on [Task 2.1]
- [Task 2.3] depends on [Task 1.1]
- [Task 2.2], [Task 2.3], and [Task 2.4] can run in parallel after their dependencies
- [Task 3.1] depends on [Task 2.1], [Task 2.2], [Task 2.3], and [Task 2.4]
- [Task 3.2] depends on [Task 3.1]
