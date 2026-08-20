---
id: "kr-01-win32-native-audio"
kind: change
parent: "kr-01-capture-foundation"
status: completed
impact_radius:
  - "native/wasapi-audio/"
  - "electron/capture/systemAudio/"
  - "src/recorder/"
  - "src/lib/"
  - "src/export/"
  - "src/components/preview/"
---

# Change: Windows 系统音频原生采集 + VB 虚拟设备绕行 + 双轨回声对齐

## 背景

kr-01-system-audio 的 Windows 路径（getDisplayMedia loopback + MediaRecorder）实测有两个缺陷：

1. **杂音**：Chromium 回环采样率不匹配爆音 + MediaRecorder 默认低码率 Opus 失真；
2. **VB-Audio 虚拟设备用户（Voicemeeter/VB-Cable）采到全零**：VB 虚拟渲染设备的
   loopback tap 不返回应用混音（驱动怪异行为，Chromium 同样中招），实机验证三段历史
   录音的 system.wav 均为静音。

另发现衍生问题：音箱外放用户的 mic 轨会 acoustically 录入系统音，与 system.wav 混合
形成回声；两条采集链存在逐机不同的固定延迟差（实机 ~183ms），无法在采集侧补偿。

## Functional Requirements

### ADDED

#### Requirement: Windows 原生系统音频采集
The system SHALL 在 Windows 上由 Main 进程 spawn 原生 helper（`native/wasapi-audio`，
Rust + WASAPI shared-mode loopback）直采默认渲染设备混音，落盘 48kHz/2ch/int16 的
system.wav；helper 缺失/启动失败静默降级为无系统音轨，不阻断录制。

##### Scenario: 普通声卡录制
- **WHEN** 用户录制整屏且系统正在播放声音（默认渲染设备为物理声卡/HDMI/USB 音频）
- **THEN** 落盘 system.wav，内容为设备混音的 PCM 直采（无有损编码、无语音处理）

##### Scenario: 非 48kHz 设备
- **WHEN** 默认渲染设备混音格式不是 48kHz（如 44.1kHz）
- **THEN** helper 用 rubato sinc 重采样到 48kHz 落盘，规格不变

#### Requirement: VB-Audio 虚拟设备自动绕行
The system SHALL 在检测到默认渲染设备为已知 VB-Audio 虚拟设备
（"Voicemeeter Input"/"Voicemeeter AUX Input"/"Voicemeeter VAIO3 Input"/"CABLE Input"）
时，自动改采对应的总线镜像采集端点（Out B1/B2/B3 或 CABLE Output）；Voicemeeter 场景
下通过 Remote API 临时打开虚拟输入条带的 Bx 路由（仅作用于引擎运行时，录制结束恢复原值）。

##### Scenario: Voicemeeter 用户录制
- **WHEN** 默认播放设备为 "Voicemeeter Input" 且用户录制带系统声音的内容
- **THEN** system.wav 采到 "Voicemeeter Out B1" 总线内容；条带 B1 路由被临时打开，
  录制结束后恢复用户原配置

##### Scenario: Remote API 不可用
- **WHEN** Voicemeeter 未运行或 Remote DLL 不存在
- **THEN** 仅 stderr 告警提示用户手动打开路由，采集与录制照常不被阻断

#### Requirement: 双轨回声对齐
The system SHALL 在预览与导出混音前，用降采样互相关估计 system 相对 mic 的恒定偏移
并对齐（`src/lib/audioAlign.ts`）；归一化相关度不足（耳机用户 mic 轨无系统音）时不
对齐，行为与之前一致。

##### Scenario: 音箱外放用户的会话
- **WHEN** 预览或导出 mic.wav 中含系统音回声的会话
- **THEN** system 轨按估计偏移对齐，回声消除（实机：估计 +183.3ms，与独立探针一致）

##### Scenario: 耳机用户的会话
- **WHEN** mic 轨中不含系统音（互相关度低于阈值）
- **THEN** 偏移为 0，预览/导出行为与无对齐时完全一致

## 设计约束

- helper 协议与 sck-audio 完全一致：参数 `<output.wav>`、启动成功 stdout 打
  "listening"、stdin EOF 停止并 patch WAV header、失败非零退出并由 Main 清理
  header-only 残留
- VB 绕行产生的启动延迟（Remote 指令下发 ~0.8s）在 system.wav 头部补等长静音，
  保持与画面/events.json 的 t=0 对齐
- 平台分发仍在 `electron/capture/systemAudio/index.ts`；Renderer 侧 win32 与 darwin
  一样跳过 loopback 轨，避免与 helper 双写 system.wav

## 验证记录（2026-08-21，Windows 实机 + Voicemeeter Banana 环境）

- WASAPI loopback 物理端点（DELL 显示器）：0.5 振幅正弦 → 采集 peak 16384，比特级一致
- VB 绕行："Voicemeeter Out B1" 采集 0.5 振幅正弦 → peak 16000，链路打通
- Remote 路由管理：自动开 B1 生效（引擎电平表确认），退出恢复为 0
- 回声对齐：真实 115s 会话估计 +183.3ms，与 Rust 独立探针 +183ms 一致
- `npm run typecheck` 通过；macOS 路径零改动（darwin.ts 未触及，见 git diff）
