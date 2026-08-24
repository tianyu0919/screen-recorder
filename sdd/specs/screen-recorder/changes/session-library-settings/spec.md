---
id: "session-library-settings"
kind: feature
parent: ""
status: completed
impact_radius:
  - "electron/main"
  - "electron/store"
  - "electron/preload"
  - "shared"
  - "src/components/preview"
  - "src/components/settings"
  - "src/store"
dependencies:
  - "kr-01-capture-foundation"
  - "ui-modern-light-motion-refresh"
---

# Specification: 会话库、回收站与应用设置

## 1. Scope

- **In Scope**: 多路径会话索引、默认保存路径、Lenza 内部回收站、清理倒计时、恢复/永久删除、设置持久化、主题迁移、Windows 托盘和 macOS Dock 关闭行为。
- **Out of Scope**: 自动更新功能、录制文件自动迁移、云同步、跨设备索引同步、操作系统回收站集成、Linux 平台交付。

## 2. Functional Requirements

### ADDED

#### Requirement: 版本化应用设置
系统 SHALL 由 Main 进程在 `userData` 中持久化并校验版本化设置，正常应用升级不得清除既有设置。

##### Scenario: 新版本增加字段
- **WHEN** 新版本读取缺少新增字段的旧配置
- **THEN** 系统按版本迁移补齐默认值，并保留已有有效配置

##### Scenario: 配置损坏
- **WHEN** 配置无法解析或未通过 schema 校验
- **THEN** 系统采用安全默认值启动并提供友好反馈，不向 Renderer 暴露原始堆栈

#### Requirement: 默认保存路径与多路径历史
系统 SHALL 默认将新录制保存至系统视频目录下的 `Lenza` 文件夹；更改路径只影响新录制，所有历史根目录中的录制统一展示。

##### Scenario: 修改路径后继续录制
- **WHEN** 旧路径已有 10 个录制，用户更改路径后新增 5 个
- **THEN** 历史页显示全部 15 个录制，旧文件不发生搬迁

##### Scenario: 管理保存位置
- **WHEN** 用户打开应用设置
- **THEN** 系统显示当前完整路径，并提供选择新目录和打开当前目录的操作

#### Requirement: 会话可用性
系统 SHALL 区分存储根不可访问与根可访问但会话源文件缺失。

##### Scenario: 外接存储离线
- **WHEN** 已登记存储根暂时不可访问或无权限
- **THEN** 对应卡片显示“存储位置不可用”，保留索引且禁止预览和删除

##### Scenario: 文件被手动删除
- **WHEN** 存储根可访问但某会话目录不存在
- **THEN** 卡片显示“源文件已被移除”，仅允许“从历史记录移除”

#### Requirement: Lenza 内部回收站
系统 SHALL 将普通删除的完整会话移动至 Lenza 内部回收站，并保留恢复所需的原始位置元数据。

##### Scenario: 删除录制
- **WHEN** 用户在普通录制卡片执行删除并确认
- **THEN** 会话进入“回收站”分类，普通列表不再展示该项目

##### Scenario: 恢复录制
- **WHEN** 用户在回收站执行恢复且原位置可用、无路径冲突
- **THEN** 会话恢复至原位置并重新出现在普通列表

##### Scenario: 永久删除
- **WHEN** 用户永久删除单项或清空回收站
- **THEN** 系统二次确认“文件将无法恢复”，确认后才删除文件和索引

#### Requirement: 回收站保留周期与倒计时
系统 SHALL 支持 1、3、7、30 天和永久保留，默认 3 天，并在启动及运行期间清理到期项目。

##### Scenario: 展示剩余时间
- **WHEN** 项目距离清理不少于 24 小时、1 至 24 小时或不足 1 小时
- **THEN** 分别显示“X 天 X 小时”“X 小时 X 分钟”或“X 分 X 秒”

##### Scenario: 自动清理失败
- **WHEN** 到期文件因占用或权限问题无法删除
- **THEN** 系统保留项目并显示“清理失败，可重试”，不得错误移除索引

#### Requirement: 会话库交互
系统 SHALL 在历史页提供“全部录制 / 回收站”分类，卡片操作在 hover 与键盘 focus 下均可发现和操作。

##### Scenario: 普通与回收站操作
- **WHEN** 用户操作普通卡片或回收站卡片
- **THEN** 普通卡片提供删除；回收站卡片提供恢复和永久删除，并具有 loading、成功和失败反馈

#### Requirement: 应用设置界面
系统 SHALL 提供设置入口和独立设置面板，包含主题、默认保存路径、回收站保留周期和关闭行为。

##### Scenario: 修改设置
- **WHEN** 用户修改任一设置
- **THEN** 新值经 IPC 写入 Main 配置并立即反馈结果；失败时 UI 回退并提示原因

#### Requirement: 跨平台关闭行为
系统 SHALL 在未保存默认关闭行为时显示“后台运行 / 直接退出”确认和“不再提示”，并按平台实现后台运行。

##### Scenario: 仅本次选择
- **WHEN** 用户未勾选“不再提示”并选择关闭方式
- **THEN** 本次按选择执行，下次关闭仍显示确认

##### Scenario: 保存默认行为
- **WHEN** 用户勾选“不再提示”或在设置中选择关闭行为
- **THEN** 系统持久化 `background` 或 `quit`，后续关闭不再弹窗

##### Scenario: Windows 后台运行
- **WHEN** Windows 用户选择后台运行
- **THEN** 主窗口隐藏至系统托盘，点击托盘图标恢复窗口

##### Scenario: macOS 后台运行
- **WHEN** macOS 用户选择后台运行
- **THEN** 主窗口隐藏，应用保留在 Dock，点击 Dock 图标恢复窗口

#### Requirement: Windows 与 macOS 兼容边界
系统 SHALL 对 Windows 与 macOS 的路径、文件系统行为、应用生命周期和原生入口分别实现并验证，不得以一个平台的行为推断另一个平台。

##### Scenario: 平台路径与文件操作
- **WHEN** 系统创建默认目录、规范化索引路径、移动、恢复或永久删除会话
- **THEN** 使用 Electron/Node 平台路径 API，兼容 Windows 盘符与反斜杠、macOS POSIX 路径，并阻止路径越界

##### Scenario: Windows 文件占用
- **WHEN** Windows 中预览媒体仍占用会话文件或目录
- **THEN** 系统先释放 Renderer 媒体资源再执行移动或删除；仍失败时保留原状态并提示重试

##### Scenario: macOS 应用生命周期
- **WHEN** macOS 主窗口关闭、隐藏后从 Dock 激活，或所有窗口均已关闭
- **THEN** 系统遵循 macOS 应用生命周期恢复主窗口，不意外退出或创建重复窗口

##### Scenario: 双平台能力不可用
- **WHEN** 某平台的目录访问、托盘/Dock 或文件操作能力失败
- **THEN** 系统采用该平台的友好降级和错误提示，不阻断另一平台或原有录制流程
