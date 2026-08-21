---
id: "kr-05-preview-stage-fit"
kind: feature
parent: "kr-05-editor"
status: in_progress
impact_radius:
  - "src/components/preview/PreviewPlayer.tsx"
  - "src/components/preview/PreviewScreen.tsx"
  - "src/components/preview/"
dependencies:
  - "kr-02-motion-playback"
  - "kr-05-editor"
---

# Specification: 编辑器舞台自适应与检查器收起

## 1. Scope

- **In Scope**: 舞台按可用区域精确等比适配；适应/100% 预览缩放切换；100% 模式滚动查看；右侧检查器手动收起/展开。
- **Out of Scope**: 修改导出分辨率、合成器输出尺寸、运镜倍率、画面内容裁切；触控板缩放和任意百分比输入；布局状态持久化。

## 2. Functional Requirements

### ADDED

#### Requirement: 舞台精确等比适配
The system SHALL 使用舞台内容区域的实时宽高计算 Canvas CSS 显示尺寸，保持导出画布宽高比并完整显示画面。

##### Scenario: 调整窗口大小
- **WHEN** 用户连续拖动窗口边缘改变编辑器宽高
- **THEN** Canvas 在可用区域内等比缩放且始终完整可见，不拉伸、不裁切、不影响 WebGL 背板尺寸

##### Scenario: 极宽或极高窗口
- **WHEN** 舞台区域宽高比与视频宽高比不一致
- **THEN** Canvas 按限制更紧的一边适配并居中，剩余区域作为工作台留白

#### Requirement: 预览缩放模式
The system SHALL 提供“适应”和“100%”两种预览缩放模式，默认使用“适应”。

##### Scenario: 适应模式
- **WHEN** 用户选择“适应”
- **THEN** Canvas 使用舞台内最大可用等比尺寸，并随 ResizeObserver 的尺寸变化更新

##### Scenario: 100% 模式
- **WHEN** 用户选择“100%”且 1920×1080 Canvas 超过舞台可用区域
- **THEN** Canvas 按原始输出像素显示，舞台提供双向滚动以查看完整内容

#### Requirement: 检查器手动收起
The system SHALL 在详情工具栏提供检查器显示切换，收起后舞台占用释放出的宽度并立即重新适配。

##### Scenario: 收起与恢复
- **WHEN** 用户收起或重新展开右侧检查器
- **THEN** 280px 检查器隐藏或恢复，Canvas 根据新的舞台宽度重新适配，编辑参数保持不变
