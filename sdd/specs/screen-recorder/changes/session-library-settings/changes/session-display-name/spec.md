---
id: "session-display-name"
kind: feature
status: in_progress
impact_radius:
  - "shared/"
  - "electron/store/"
  - "electron/preload/"
  - "src/store/"
  - "src/components/preview/"
dependencies:
  - "session-library-settings"
  - "kr-03-background-export-queue"
---

# Specification: 录像显示名称与内联重命名 (Specification)

## 1. Scope
- **In Scope**: 稳定的会话显示名称；详情页双击内联编辑；列表同步；持久化；MP4/WebM/SRT 默认命名；旧会话回退。
- **Out of Scope**: 修改 `sessionId`；重命名/移动磁盘会话目录；列表卡片直接编辑；批量命名；导出历史重命名。

## 2. Functional Requirements

### ADDED
#### Requirement: 内联重命名
系统 SHALL 允许用户双击详情页录像名称进入原地编辑，Enter 或失焦保存，Escape 取消。

##### Scenario: 保存有效名称
- **WHEN** 用户提交通过校验的新名称
- **THEN** 系统持久化名称并立即退出编辑态

##### Scenario: 非法名称
- **WHEN** 名称为空、超过 80 字符或包含跨平台文件名危险内容
- **THEN** 系统不修改原名称，保持编辑态并显示就地错误

#### Requirement: 跨视图同步
系统 SHALL 以 `sessionId` 为稳定身份，把名称修改同步到当前详情页和“全部录像”列表。

##### Scenario: 返回列表
- **WHEN** 用户重命名成功后返回“全部录像”
- **THEN** 对应卡片显示新名称，无需重新扫描磁盘

##### Scenario: 重启应用
- **WHEN** 用户重启应用或手动刷新会话列表
- **THEN** 系统从会话索引恢复显示名称

#### Requirement: 导出命名一致
系统 SHALL 使用显示名称作为后续 MP4/WebM/SRT 的默认基本文件名，并在缺失显示名称时回退 `sessionId`。

##### Scenario: 同名产物
- **WHEN** 目标目录存在同名导出文件
- **THEN** 系统继续追加 `(1)`、`(2)`，不覆盖已有文件

### MODIFIED
#### Requirement: 稳定会话身份
显示名称只作为可编辑元数据；会话目录、媒体 URL、缩略图缓存、字幕任务和编辑引用 SHALL 始终使用不可变 `sessionId`。

##### Scenario: 重命名后继续编辑
- **WHEN** 用户重命名后继续预览、生成字幕或导出
- **THEN** 所有媒体和编辑数据仍可通过原 `sessionId` 正常访问
