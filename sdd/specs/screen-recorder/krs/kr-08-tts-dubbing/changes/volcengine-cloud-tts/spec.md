---
id: "kr-08-volcengine-cloud-tts"
kind: feature
parent: ""
status: draft
impact_radius:
  - "electron/tts/"
  - "electron/store/"
  - "electron/preload/"
  - "shared/"
  - "src/components/settings/"
  - "src/components/preview/"
  - "src/store/"
  - "docs/TECH_DESIGN.md"
dependencies:
  - "kr-08-tts-dubbing"
  - "kr-08-high-quality-bundled-voices"
---

# Specification: 火山引擎云端高清 TTS

## 1. Scope

- **In Scope**: 保持现有内置本地 TTS 为默认；可选火山引擎 V3 云端高清 provider；新版单 API Key；默认且可修改的 `seed-tts-2.0` 资源 ID；精选中英文音色与自定义 voice ID；本地加密凭据；隐私/计费披露；保存与测试连接；按字幕段请求、缓存、时长贴合及原子替换；云端错误恢复。
- **Out of Scope**: 应用自营代理服务或共享密钥；旧版 App ID + Access Token 鉴权；上传视频、原始麦克风音频或其他文件；整段合成后的强制对齐；逐字幕段选择不同音色；自动购买/开通火山套餐；自定义 API 主机；把云端模型或结果公开分享给其他用户。

## 2. Functional Requirements

### ADDED

#### Requirement: 本地默认与云端可选
The system SHALL 保持当前随安装包分发的本地 TTS provider 为默认选项，并在用户主动选择时提供“火山引擎云端高清”provider；云端不可用不得阻断本地生成。

##### Scenario: 未配置 API Key
- **WHEN** 用户首次打开配音面板或处于离线环境
- **THEN** 本地音色仍可直接试听和生成，火山音色显示需配置或网络不可用且不能被默认选中

##### Scenario: 选择云端音色
- **WHEN** 用户已配置 Key 并选择火山引擎音色
- **THEN** 面板提供精选中英文音色，也允许使用控制台中的自定义 voice ID，且明确标记为云端服务

#### Requirement: 用户自有凭据的本地安全存储
The system SHALL 只支持火山引擎新版单 API Key，并通过 Electron `safeStorage` 加密后保存在本机专用 secret 文件中；已保存明文不得被 Renderer、普通设置文件、编辑文档、缓存键或日志回读或持久化。

##### Scenario: 仅保存到本地
- **WHEN** 用户输入 API Key 和资源 ID 并点击“仅保存到本地”
- **THEN** 系统不发起网络请求，将 Key 加密落盘，随后只显示已配置状态和末四位并清空明文输入

##### Scenario: 系统安全存储不可用
- **WHEN** 当前系统无法提供 `safeStorage` 加密
- **THEN** 系统拒绝保存并显示可读原因，绝不降级为明文存储

##### Scenario: 替换或清除
- **WHEN** 用户替换或清除 API Key
- **THEN** Main 原子更新或删除本地秘密并递增凭据修订，Renderer 仍不能获得旧 Key

#### Requirement: 固定官方端点与可配置资源
The system SHALL 只把 API Key 和字幕请求发送至代码内固定的火山引擎官方 TTS 端点，使用 `X-Api-Key` 鉴权；资源 ID 默认 `seed-tts-2.0` 且允许用户修改。

##### Scenario: 使用默认资源
- **WHEN** 用户未修改资源 ID 并发起测试或生成
- **THEN** 请求使用 `seed-tts-2.0`，API Key 不会被发送到任何其他主机

##### Scenario: 套餐配置不同
- **WHEN** 用户账号要求其他资源 ID 或精选音色没有权限
- **THEN** 用户可修改资源 ID 或填写控制台中的自定义 voice ID，并在失败时获得套餐/权限指引

#### Requirement: 文本传输、隐私与费用披露
The system SHALL 在第一次向火山引擎发送任何文本之前征得明确同意，说明仅发送待合成文本，不发送视频、原始麦克风音频或其他文件，并提示请求可能产生火山引擎费用。

##### Scenario: 首次测试连接
- **WHEN** 用户首次点击“测试连接”
- **THEN** 界面先披露将发送一小段固定测试文本及潜在费用，只有确认后才发起请求

##### Scenario: 首次生成云端配音
- **WHEN** 用户首次用火山音色生成配音
- **THEN** 界面展示将发送的字幕段数、Unicode 字符数、数据范围和潜在费用，只有确认后才发起请求

##### Scenario: 后续生成
- **WHEN** 用户已同意当前版本披露并再次生成
- **THEN** 界面继续显示段数和字符数但无需重复弹窗；披露内容版本变化后必须重新确认

#### Requirement: 测试连接
The system SHALL 在设置页提供与实际 provider 共用协议解析和错误处理的“测试连接”，并使用固定短文本执行一次真实合成。

##### Scenario: 测试成功
- **WHEN** Key、资源 ID 和测试 voice ID 均有效
- **THEN** 系统报告成功并可播放测试音频，且不把测试文本、Key 或原始响应写入日志

##### Scenario: 测试失败
- **WHEN** 网络、鉴权、资源或音色权限有误
- **THEN** 系统保留已本地保存的配置，显示可操作的分类错误，不影响本地 TTS

#### Requirement: 分段请求、缓存与原子结果
The system SHALL 按字幕段逐条请求云端，并以 provider、文本、voice ID、资源 ID、凭据修订和 provider 版本作为原始段缓存身份；任务全部成功后才原子替换最终派生轨。

##### Scenario: 重复生成
- **WHEN** 字幕文本、音色、资源 ID、凭据修订和 provider 版本均未变化
- **THEN** 已成功段直接从本地缓存复用，不重复调用火山引擎；字幕时间变化只重跑时长贴合和组装

##### Scenario: 部分段失败
- **WHEN** 生成过程中一个或多个云端段失败
- **THEN** 系统不发布不完整派生轨、不混入本地音色，并保留此前最终派生轨和本次已成功段缓存供重试复用

##### Scenario: 切换账号或配置
- **WHEN** 用户替换 Key、修改资源 ID 或切换 voice ID
- **THEN** 相应缓存身份变化，后续生成不得误用旧配置下的段音频

#### Requirement: 云端失败恢复与会话隔离
The system SHALL 对云端超时、限流、服务错误、取消和会话切换提供可恢复处理，不自动切换本地 provider，也不把结果写入错误会话。

##### Scenario: 网络或服务失败
- **WHEN** 云端请求超时、限流或返回服务错误
- **THEN** 系统保留已有配音，提示重试或手动切换本地音色，不自动重试整个任务或静默降级

##### Scenario: 取消或切换会话
- **WHEN** 用户取消生成或在请求期间打开其他会话
- **THEN** 未完成请求被中止，完成回调按 `sessionId/taskId` 隔离，不得更新其他会话

### MODIFIED

#### Requirement: TTS 引擎与音色管理
kr-08 的本地模型继续作为默认、离线可用的 TTS provider；原“云端 TTS 仅留抽象接口”修改为可选接入火山引擎。任何云端选择都必须显式标记第三方服务和配置状态。

##### Scenario: 本地与云端并存
- **WHEN** 用户打开配音音色选择
- **THEN** 本地离线音色与火山云端音色分组展示，默认保持本地，切换 provider 不删除已有本地模型或配音文件

