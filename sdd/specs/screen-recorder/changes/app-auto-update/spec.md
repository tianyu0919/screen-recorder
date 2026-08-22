---
id: "app-auto-update"
kind: feature
parent: ""
status: in_progress
impact_radius:
  - "electron/main"
  - "electron/updater"
  - "electron/preload"
  - "electron/store"
  - "shared"
  - "src/components/settings"
  - "src/components"
  - "src/store"
  - "electron-builder.yml"
  - ".github/workflows/release.yml"
dependencies:
  - "session-library-settings"
  - "ui-modern-light-motion-refresh"
---

# Specification: 应用更新检测与安装

## 1. Scope

- **In Scope**: 正式 GitHub Release 检测、启动延迟自动检查、手动检查、版本化设置、顶部升级入口、Radix/shadcn Tooltip、轻量更新弹层、Windows 用户确认下载/进度/重启安装、macOS 未签名降级、发布元数据与双平台验证。
- **Out of Scope**: Draft/Pre-release、beta 频道、静默下载或静默安装、自建更新服务器、增量渠道管理、macOS 临时签名绕过、自动申请或配置 Apple/Windows 证书、Linux 更新。

## 2. Functional Requirements

### ADDED

#### Requirement: 正式版本检查
系统 SHALL 通过 Main 进程检查公开 GitHub 仓库的正式 Release，并忽略 Draft 与 Pre-release。

##### Scenario: 启动自动检查
- **WHEN** 自动检查开启、应用启动约 10 秒且当前未录制
- **THEN** 系统在后台检查一次更新，不自动下载任何文件

##### Scenario: 录制期间到达检查时机
- **WHEN** 自动检查触发时正在录制
- **THEN** 系统推迟检查至录制结束，不增加录制热路径负载

##### Scenario: 手动检查
- **WHEN** 用户在设置页点击“检查更新”
- **THEN** 系统立即展示检查中状态，并返回可升级、已是最新版或中文错误反馈

#### Requirement: 更新入口与提示
系统 SHALL 仅在发现新版本后，于主题切换按钮左侧显示升级图标，并使用项目现有 Radix/shadcn Tooltip。

##### Scenario: 发现新版本
- **WHEN** 更新状态为可升级
- **THEN** 顶部显示升级图标，hover 提示“发现新版本 vX.X.X”，点击打开更新弹层

##### Scenario: 没有新版本
- **WHEN** 尚未检查、检查中、已是最新版或检查失败且没有已知更新
- **THEN** 顶部不渲染升级图标且不保留空白占位

##### Scenario: 主题切换提示
- **WHEN** 用户 hover 或键盘聚焦主题切换按钮
- **THEN** 系统使用同一 Tooltip 组件说明操作，不使用原生 `title`

#### Requirement: 更新确认弹层
系统 SHALL 在升级图标被点击后显示轻量弹层，包含版本、简短更新说明、平台能力与明确操作，且不因打开弹层直接下载。

##### Scenario: 更新说明缺失或过长
- **WHEN** Release 没有可用说明或内容超出弹层承载范围
- **THEN** 系统使用版本信息降级或截断后的安全纯文本，不渲染不受信任 HTML

#### Requirement: Windows 应用内更新
系统 SHALL 在 Windows 上由用户确认后下载 NSIS 更新，显示实时进度，并仅在用户明确操作后重启安装。

##### Scenario: 下载更新
- **WHEN** Windows 用户在更新弹层点击“立即下载”
- **THEN** 系统开始单个下载任务，持续显示百分比与可理解的状态

##### Scenario: 下载完成
- **WHEN** 更新包下载并校验完成
- **THEN** 系统显示“重启并安装”，不自动退出应用

##### Scenario: 录制期间安装
- **WHEN** 更新已下载但应用正在录制
- **THEN** “重启并安装”禁用并说明需结束录制，系统绝不主动停止录制

##### Scenario: 下载或安装错误
- **WHEN** 更新器返回网络、元数据、校验或安装错误
- **THEN** 系统显示中文错误与可用的重试/打开 Release 操作，不暴露原始堆栈

#### Requirement: macOS 未签名降级
系统 SHALL 在没有 Developer ID 正式签名与 notarization 的阶段，只提供版本检查和 GitHub Release 跳转，不执行应用内下载或替换。

##### Scenario: macOS 发现更新
- **WHEN** macOS 用户打开更新弹层
- **THEN** 系统说明当前需手动安装，主操作打开对应版本的 GitHub Release

##### Scenario: ad-hoc 或自签名构建
- **WHEN** 应用仅有 ad-hoc 或自签名身份
- **THEN** 系统不得将其视为可安全应用内更新的正式签名，不调用应用内安装

#### Requirement: 更新设置持久化
系统 SHALL 将 `autoCheckUpdates` 写入 Main 的版本化 `userData/settings.json`，默认开启，并兼容既有设置升级。

##### Scenario: 读取旧版设置
- **WHEN** V1 设置不包含自动检查字段
- **THEN** 系统迁移并补默认开启，保留主题、路径、回收站与关闭行为

##### Scenario: 用户关闭自动检查
- **WHEN** 用户在设置页关闭自动检查
- **THEN** 后续启动不再自动检查，但手动检查仍可用

#### Requirement: 更新设置界面
系统 SHALL 在设置页展示当前应用版本、自动检查开关、“检查更新”按钮和最近检查结果。

##### Scenario: 当前已是最新版
- **WHEN** 手动检查确认没有更高正式版本
- **THEN** 设置页显示短暂且可访问的成功反馈

#### Requirement: 发布产物完整性
系统 SHALL 为 Windows 发布 electron-updater 所需安装包、更新元数据与 blockmap，并为 macOS 发布 DMG、ZIP、元数据和 blockmap。

##### Scenario: Tag 发布
- **WHEN** 与 `package.json` 版本一致的 `v*` tag 触发 Release 流水线
- **THEN** GitHub 正式 Release 包含对应平台更新器解析所需的全部产物

##### Scenario: 版本不一致
- **WHEN** tag 版本与 `package.json` 版本不一致
- **THEN** 发布流程失败并给出明确原因，避免生成不可发现的更新

#### Requirement: 更新功能隔离
系统 SHALL 保证检查、下载、失败和待安装状态不破坏录制、会话历史、编辑、导出或既有设置。

##### Scenario: 更新服务不可用
- **WHEN** 更新初始化失败、GitHub 不可达或发布元数据损坏
- **THEN** Lenza 其余功能正常启动与运行，用户可重试更新操作
