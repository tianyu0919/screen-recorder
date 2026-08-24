# Design: macOS 原生窗口顶栏与设置交互

## 1. Architecture

变更保持 Main / Renderer / shared 边界不变，在现有平台判断点收敛行为：

```text
Renderer App
├─ macOS title bar: 红绿灯 | 可拖拽区 | 更新 / 主题 / 设置
├─ Windows header: 品牌 | 更新 / 主题 / 设置 / 窗口控制
└─ SettingsPanel
   ├─ macOS: 不渲染“关闭应用”
   └─ Windows: 保留关闭策略

Main window close
├─ darwin: backgroundWindow(win) → hide → Dock activate 恢复
└─ win32: closeBehavior → background / quit / 首次确认
```

macOS 顶栏使用既有 `hiddenInset`，Renderer 仅负责填充红绿灯右侧区域。工具按钮必须放在 `app-nodrag` 容器内，中间空白区域保持 `app-drag`。

## 2. Data Model & Interfaces

不新增 IPC 或共享类型。`AppSettings.closeBehavior` 继续保留以兼容 Windows 和既有配置：

```typescript
export type CloseBehavior = 'background' | 'quit'

export interface AppSettings {
  closeBehavior: CloseBehavior | null
}
```

macOS 不读取该字段决定窗口关闭结果，也不在设置界面中提供修改入口。这样无需迁移或删除用户已有设置。

## 3. Data Flow & Interaction

1. macOS 用户点击红色关闭按钮。
2. Main 的 `close` 监听器检测 `darwin`，直接调用 `backgroundWindow` 隐藏窗口。
3. 用户点击 Dock 图标时，既有 `activate` 监听器调用 `showWindow` 恢复同一窗口。
4. 用户按 `⌘Q` 或菜单栏退出时，`before-quit` 设置 `quitting`，允许窗口真正关闭并结束进程。
5. Windows 继续读取 `closeBehavior` 并走托盘或退出逻辑。

设置抽屉打开时，遮罩与抽屉根节点显式使用 `app-nodrag`。右上角按钮调用 `onClose`；点击遮罩空白调用 `onClose`；仅在抽屉打开期间注册 Escape 监听，关闭或卸载时清理。

## 4. Visual Direction

- **布局**：macOS 顶部形成 40px 原生工具栏，左侧为系统红绿灯安全区，中段为拖拽面，右侧为三个轻量工具入口；品牌标题进入下方内容标题行。
- **色彩**：继续使用现有 `base / surface / ink / accent` 双主题 token，不增加装饰性色。
- **层级**：顶栏以细分隔线或表面层级与内容区区分，不模拟 Windows 标题栏按钮。
- **签名元素**：红绿灯和右侧工具组形成一条平衡的“镜头控制条”，中间保留宽阔拖拽区。

## 5. Error Handling

- **抽屉关闭期间重复输入**：`open` 变为 false 后监听立即清理，重复 Escape 或点击不产生额外状态。
- **macOS 已保存 `quit`**：关闭窗口时忽略该旧值，始终隐藏，不修改磁盘配置。
- **Windows 托盘创建失败**：继续沿用现有降级，恢复并保留窗口。
- **录制中退出**：`⌘Q` 继续进入既有退出/录制保护流程，不由本变更绕过。
