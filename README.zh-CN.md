# Screen Recorder

[English](./README.md) | 简体中文

一款类似 Screen Studio 的桌面录屏工具，基于 Electron 构建：**录制时只记录数据，导出/预览时自动运镜合成。**

缩放运镜、鼠标美化、点击特效不在录制时烧录进画面，而是把屏幕画面和高频鼠标/键盘事件一起采集，渲染时基于"虚拟相机"重新合成 —— 所有效果在录完之后仍然可以调整。

## 功能特性

- **屏幕/窗口采集** — 整屏（主模式）或单窗口，走 ScreenCaptureKit 路径的 `getDisplayMedia`
- **事件驱动录制** — 鼠标轨迹（60–120Hz 轮询）、点击、键盘事件与视频同步落盘为 `events.json`
- **自动缩放运镜** — 点击区域自动 zoom in，闲置时回到全景，spring 阻尼曲线保证动画有"肉感"
- **离线导出管线** — Worker 线程确定性逐帧渲染：WebGL 合成器 → WebCodecs 编码 → MP4 封装，输出帧率恒定
- **录制与渲染分离** — 录制期 CPU 占用低；预览和导出共用同一套虚拟相机渲染管线

> 状态：开发早期。完整架构和里程碑规划见 [技术方案文档](./docs/TECH_DESIGN.md)。

## 技术栈

- **Electron** + **React** + **TypeScript**，构建用 **electron-vite**
- 屏幕采集：`desktopCapturer` + `getDisplayMedia`
- 全局输入：[`uiohook-napi`](https://www.npmjs.com/package/uiohook-napi) + `screen.getCursorScreenPoint` 轮询
- 渲染：自研 WebGL 合成器（预览/导出共用）
- 解码/编码/封装：WebCodecs + `mp4-muxer`
- 状态管理：**zustand** · UI：**Tailwind CSS** + shadcn/ui

## 快速开始

需要 Node.js 18+。

```bash
# 安装依赖（公网 registry，见 .npmrc）
npm install

# 开发模式启动（带热更新）
npm run dev

# 生产构建
npm run build

# 类型检查
npm run typecheck
```

### macOS 权限

应用需要两项权限才能正常工作：

- **屏幕录制** — 用于屏幕采集
- **辅助功能** — 用于全局输入钩子（点击/键盘事件）

在 *系统设置 → 隐私与安全性* 中授权后，重启应用。

## 项目结构

```
screen-recorder/
├── electron/               # Main 进程
│   ├── capture/            # 屏幕/音频采集
│   ├── input/              # 鼠标轨迹轮询、uiohook 事件
│   └── store/              # 录制会话落盘
├── src/                    # Renderer 进程（React）
│   ├── components/         # UI
│   ├── recorder/           # 录制控制
│   └── store/              # Renderer 状态
├── shared/                 # 双进程共享的类型与 IPC 契约
├── docs/TECH_DESIGN.md     # 完整技术方案
└── sdd/                    # Spec-driven development 文档
```

## 录制数据格式

每次录制保存到 `recordings/<session-id>/`：

```
├── screen.webm    # 原始屏幕画面
├── mic.wav        # 麦克风（可选）
└── events.json    # 元数据 + 鼠标轨迹、点击、按键（时间戳相对录制开始）
```

所有录制后效果（缩放、点击波纹、按键回显）都在渲染期由 `events.json` 驱动生成。
