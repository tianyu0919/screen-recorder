---
id: "kr-05-preview-quality-control"
kind: change
parent: "kr-05-preview-stage-fit"
status: completed
impact_radius:
  - "shared/types.ts"
  - "electron/store/appSettings.ts"
  - "electron/preload/index.ts"
  - "electron/ipc.ts"
  - "src/store/settingsStore.ts"
  - "src/lib/stageFit.ts"
  - "src/components/preview/"
  - "src/components/ui/"
  - "src/App.tsx"
  - "docs/TECH_DESIGN.md"
dependencies:
  - "kr-05-preview-stage-fit"
  - "kr-05-focus-preview"
  - "session-library-settings"
---

# Specification: 编辑预览清晰度与性能提醒

## 1. Scope

- **In Scope**: 普通编辑预览的自动/流畅/高清/超清四档；本机全局持久化；基于 rVFC 的持续卡顿检测；顶部居中的 shadcn Sonner 可操作 Toast；会话卡片时长可读性优化；深浅主题与 macOS/Windows 共用行为。
- **Out of Scope**: 修改源视频、`edit.json`、导出分辨率或编码质量；根据实时帧率自动反复升降档；硬件跑分；专注预览清晰度档位；把性能统计持久化或上传；修改会话卡片其他元数据布局。

## 2. Functional Requirements

### ADDED

#### Requirement: 普通编辑预览清晰度分档
系统 SHALL 在编辑布局控制区提供自动、流畅、高清、超清四档清晰度，并仅用该设置计算普通编辑模式的 WebGL backing。

##### Scenario: 默认自动档
- **WHEN** 用户首次使用功能或旧设置文件不含清晰度字段
- **THEN** 系统选择自动档，根据当前舞台物理像素渲染；Retina 设备最高使用 `1920×1080`，普通 DPR 设备避免无收益地超过 `1280×720`

##### Scenario: 手动选择档位
- **WHEN** 用户选择流畅、高清或超清
- **THEN** 系统分别以最高 `1280×720`、`1920×1080`、`2560×1440` 的档位约束重新计算 backing，并保持画面比例、CSS 显示尺寸和当前播放位置

##### Scenario: 输出尺寸较小
- **WHEN** 录制或输出尺寸小于所选档位上限
- **THEN** backing 不得被放大到超过最终输出尺寸

#### Requirement: 本机全局偏好
系统 SHALL 将预览清晰度写入应用 `settings.json`，供所有会话复用，而不写入编辑文档。

##### Scenario: 重启和切换会话
- **WHEN** 用户选择清晰度后重启应用或打开另一会话
- **THEN** 系统继续使用最后成功保存的档位

##### Scenario: 持久化值非法
- **WHEN** 设置文件中的档位缺失或不属于四个合法值
- **THEN** 系统安全回退为自动档且不阻断启动

#### Requirement: 持续卡顿提醒
系统 SHALL 仅在普通编辑模式连续播放时检测持续呈现不足，并通过窗口顶部居中的 shadcn Sonner Toast 询问用户是否降档。

##### Scenario: 检测到持续卡顿
- **WHEN** 连续播放预热 3 秒后，2 秒统计窗口内的实际呈现帧率低于源视频帧率的 70%，当前档位不是流畅且页面位于前台
- **THEN** 系统显示一次非阻塞 warning Toast，提供“切换到流畅”和“保持当前清晰度”两个操作

##### Scenario: 用户切换到流畅
- **WHEN** 用户点击 Toast 的“切换到流畅”
- **THEN** 系统把本机全局档位保存为流畅、立即重建较低分辨率 backing，并保持当前播放位置

##### Scenario: 用户保持当前清晰度
- **WHEN** 用户点击“保持当前清晰度”
- **THEN** 系统保持档位不变，并在本次打开该会话期间不再显示卡顿提醒

##### Scenario: 不应采样的状态
- **WHEN** 视频暂停、seek、裁剪跳转、时长探针、页面进入后台、进入专注预览，或档位已是流畅
- **THEN** 系统不判断卡顿并重置连续播放统计，恢复有效状态后重新预热

### MODIFIED

#### Requirement: 专注预览清晰度独立
系统 SHALL 保留专注预览现有的设备像素比适配和 `2560×1440` 上限，不让普通编辑清晰度档位降低或覆盖专注预览。

##### Scenario: 从流畅档进入专注预览
- **WHEN** 普通编辑档位为流畅且用户进入专注预览
- **THEN** 专注预览仍按既有 Retina 高清规则计算 backing，退出后普通编辑恢复流畅档

#### Requirement: 会话卡片时长可读性
系统 SHALL 将录制时长放在卡片正文的会话 ID 元数据行右侧，不再让时长覆盖缩略图内容。

##### Scenario: 明亮或复杂缩略图
- **WHEN** 会话缩略图为白色、浅色或高细节画面
- **THEN** 缩略图上不显示时长；卡片正文在会话 ID 右侧持续显示独立、清晰的等宽时长标签
