---
id: "kr-03-background-export-queue"
kind: change
parent: "kr-03-mp4-export"
status: in_progress
impact_radius:
  - "src/store/"
  - "src/components/"
  - "electron/store/appSettings.ts"
  - "electron/ipc.ts"
  - "electron/preload/"
  - "shared/"
dependencies:
  - "kr-03-mp4-export"
---

# Specification: 后台导出队列与默认导出目录

## Scope

- **In Scope**: 应用级串行队列；点击时编辑快照；跨页面继续；全局折叠提示与当前/总数；成功/失败结果保留；取消当前/等待任务；默认目录；临时“导出到…”；无覆盖命名；退出确认；WebM fallback。
- **Out of Scope**: 应用退出后恢复队列；多任务并行编码；断点续传；导出历史中心；云端导出。

## Requirements

#### Requirement: 应用级串行导出队列
系统 SHALL 在应用生命周期内一次只编码一个任务，并允许其他录像按点击顺序排队。

##### Scenario: 离开详情页
- **WHEN** 导出过程中返回列表、切换录像或隐藏窗口
- **THEN** Worker 继续运行，任务状态和进度保持在全局 Store

##### Scenario: 排队
- **WHEN** 已有任务运行时用户导出另一录像
- **THEN** 新任务冻结点击时编辑快照并进入等待队列，前一任务结束后自动启动

#### Requirement: 全局导出提示
系统 SHALL 在右上角显示全局导出状态，并允许查看和取消任务。

##### Scenario: 返回列表
- **WHEN** 用户离开正在导出的详情页
- **THEN** 提示展开约 2 秒显示文件名和进度，再收缩为进度胶囊；点击可展开队列

##### Scenario: 后台提示已经展示
- **WHEN** 小胶囊已经存在，用户再次从任意录像详情返回列表
- **THEN** 胶囊保持收起状态，不因重复导航再次展开；手动点击胶囊或任务结束仍可触发展开

##### Scenario: 任务结束
- **WHEN** 任务成功或失败
- **THEN** 提示自动展开；成功与失败均保留在本次应用生命周期的展开队列中，直到用户逐项关闭

##### Scenario: 全队列成功
- **WHEN** 本轮全部导出任务均成功且不存在失败任务
- **THEN** 顶部图标切换为成功状态并播放一次轻量庆祝粒子；完成前若胶囊已收起则保持收起并在胶囊内反馈，不自动展开；若原本展开则在展开框内反馈；两种状态均约 2.4 秒后平滑关闭并清理本轮结果；减少动态效果模式下省略粒子

##### Scenario: 队列存在失败
- **WHEN** 全部任务结束但至少一个任务失败
- **THEN** 提示保持展开并保留成功/失败明细，不播放全成功动画，也不自动关闭

##### Scenario: 多任务进度
- **WHEN** 队列中存在多个导出任务
- **THEN** 收起胶囊和展开标题显示当前/总数（例如 `1/2`、`2/2`），展开列表完整显示等待、导出中、成功和失败状态

#### Requirement: 默认与临时导出目录
系统 SHALL 默认将产物直接写入 `Videos/Lenza/Exports`，允许在应用设置中更改、打开该目录，并保留单次“导出到…”。

##### Scenario: 默认导出
- **WHEN** 用户点击主导出按钮
- **THEN** 系统无需另存为对话框，直接写入当前默认导出目录

##### Scenario: 临时位置
- **WHEN** 用户点击“导出到…”并选择目录
- **THEN** 仅当前任务写入该目录，不修改默认设置

#### Requirement: 无覆盖保存
系统 SHALL 对默认和临时目录保存统一采用无覆盖命名。

##### Scenario: 同名文件
- **WHEN** 目标目录已存在 `name.mp4`
- **THEN** 系统原子选择 `name (1).mp4`、`name (2).mp4` 等首个可用名称，不覆盖已有文件

##### Scenario: 编码降级
- **WHEN** H.264 不可用且导出降级为 WebM
- **THEN** 系统保留任务与命名语义，并使用 `.webm` 扩展名

#### Requirement: 退出保护
系统 SHALL 在真正退出应用且存在运行或等待任务时提示退出会取消任务。

##### Scenario: 确认退出
- **WHEN** 用户确认退出
- **THEN** 系统取消当前 Worker 和等待队列并退出，不留下半成品
