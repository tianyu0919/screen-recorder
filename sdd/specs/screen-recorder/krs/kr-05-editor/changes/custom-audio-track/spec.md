---
id: "kr-05-custom-audio-track"
kind: change
parent: "kr-05-editor"
status: completed
impact_radius:
  - "electron/ipc.ts"
  - "electron/preload/index.ts"
  - "shared/ipc.ts"
  - "src/components/preview/"
  - "src/store/previewStore.ts"
  - "src/store/exportStore.ts"
  - "src/export/"
  - "src/lib/"
---

# Change: 自定义音轨（波形 + 拖拽定位）

## 背景

在 audio-volume（分轨音量）基础上，允许用户把外部音频文件（BGM/旁白）作为自定义音轨
加入编辑器：时间轴上以波形块可视呈现，按住拖动对齐画面位置，预览与导出听感一致。
详细取舍见 proposal.md / design.md。

## Scope

- **In Scope**: 文件选择 IPC；解码 + 波形峰值；时间轴「音频」行波形块拖拽定位、双端裁剪与素材滑移；
  真实视频片尾约束；预览多 clip 同步播放；导出 N 轨混音（mixTracks）；检查器 clip 列表（音量/删除）。
- **Out of Scope**: clip 分割、循环播放、淡入淡出、波形缩放编辑、多轨上下分层、
  持久化（随 edit.json 计划）、>100% 增益。

## Functional Requirements

### ADDED

#### Requirement: 添加自定义音轨
The system SHALL 在检查器「音频」区提供「添加音轨」入口，弹出系统文件对话框
（wav/mp3/m4a/aac/ogg/flac），选中后解码并在时间轴「音频」行生成波形块。

##### Scenario: 正常添加
- **WHEN** 用户选择一个可解码的音频文件并确认
- **THEN** 时间轴出现该文件的波形块（起点 0ms），检查器列表出现对应条目

##### Scenario: 导入音频长于视频
- **WHEN** 导入音频的时长超过真实视频时长
- **THEN** clip 在片尾自动截断，时间轴、预览和导出均不超过视频片尾

##### Scenario: 取消对话框
- **WHEN** 用户在文件对话框点取消
- **THEN** 不产生任何状态变化

##### Scenario: 解码失败
- **WHEN** 文件损坏或格式不支持
- **THEN** 检查器提示「无法解码该音频文件」，不产生 clip

#### Requirement: 波形块拖拽定位
The system SHALL 允许按住波形块水平拖动调整其在时间轴上的起始位置
（≥ 0ms，不超过片尾），拖动不触发播放头 seek。

##### Scenario: 拖动对齐
- **WHEN** 用户按住波形块向右拖动
- **THEN** 块随指针实时移动，松手后 offsetMs 固定，预览从该位置起播该音频

#### Requirement: 音轨双端裁剪
The system SHALL 允许拖动波形块左右边缘非破坏性裁剪音频头尾；拖动左边缘时保持
音频内容与时间轴的相对位置，拖动右边缘时保持 clip 起点不变，最短保留 100ms。

##### Scenario: 裁掉音频开头
- **WHEN** 用户将 clip 左边缘向右拖动 1s
- **THEN** clip 时间轴起点右移 1s，预览和导出均从原音频 1s 处开始

##### Scenario: 裁掉音频结尾
- **WHEN** 用户将 clip 右边缘向左拖动 1s
- **THEN** clip 起点不变，预览和导出均提前 1s 停止

#### Requirement: 音频素材滑移编辑
The system SHALL 在保持音频块时间轴位置和长度不变的前提下，允许通过横向滚动移动原音频内部的实际播放区间，并沿用时间轴现有的跨平台滚轮方向判断。

##### Scenario: 横向滚动波形
- **WHEN** 鼠标位于波形块上，Windows 横向滚轮或 macOS 触控板横向手势占主导
- **THEN** 系统同步移动 trimStartMs 与 trimEndMs，实时更新波形和素材起止时间，且不改变 offsetMs 与片段长度

##### Scenario: 纵向滚动波形
- **WHEN** 鼠标位于波形块上且纵向滚动占主导
- **THEN** 手势继续交给时间轴执行既有缩放，不改变音频内部播放区间

##### Scenario: 素材边界
- **WHEN** 横向滑移到原音频开头或结尾
- **THEN** 播放区间钳制在原音频范围内，预览和导出保持一致

#### Requirement: 真实视频片尾为统一边界
The system SHALL 在视频元数据可用后，以真实视频时长过滤越界事件并重新派生运镜；
原始 events.json 保持不变。

##### Scenario: 停止录制后的尾部事件
- **WHEN** events.json 中点击或按键时间晚于真实视频片尾
- **THEN** 时间轴不显示该事件，该点击不生成提前缩放关键帧或点击波纹

#### Requirement: 自定义轨预览与导出
The system SHALL 在预览播放进入 clip 区间时播放对应音频（音量 = clip 增益），
并在导出时把 clip PCM 按 offsetMs 铺到源时间轴与 mic/system 混音，经裁剪统一映射。

##### Scenario: 预览区间外静音
- **WHEN** 播放头不在任何 clip 区间内
- **THEN** 对应 clip 的音频不发声

##### Scenario: 导出一致性
- **WHEN** 用户添加 BGM 拖到 2s 处并导出
- **THEN** 产物中 BGM 从约 2s 处响起，电平为 gain 缩放后的值，裁剪后仍与画面对齐

##### Scenario: 关闭/切换会话
- **WHEN** 用户返回会话列表或打开另一会话
- **THEN** 自定义 clip 清空（本期不持久化）

#### Requirement: 自定义音轨播放性能
The system SHALL 在自定义音轨播放期间避免容差内的重复音频 seek，并将静态时间轴内容与
逐帧播放头更新隔离；优化不得改变 clip 定位、裁剪、增益或导出结果。

##### Scenario: 连续播放
- **WHEN** 用户添加自定义音轨并连续播放视频
- **THEN** 音频只在开始播放、主动 seek、进入 clip 或明显漂移时校准，播放头保持流畅

##### Scenario: 播放头逐帧推进
- **WHEN** 视频帧回调更新播放头位置
- **THEN** 音频波形、事件点和运镜片段不因播放头变化重复执行完整渲染计算
