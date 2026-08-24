# Design: 物理显示器选中边框

## 1. Architecture

该能力由 Renderer 发出选择意图，Main 负责来源解析和原生窗口生命周期。覆盖层属于平台能力，不进入 React DOM，也不进入录制会话数据。

```text
Renderer appStore
  ├─ select screen ───────> IPC ShowDisplaySelectionOutline(sourceId)
  ├─ select window/error ─> IPC HideDisplaySelectionOutline
  └─ start recording ─────> await HideDisplaySelectionOutline
                                      │
Main displaySelectionOutline          ▼
  ├─ desktopCapturer source.display_id → screen.Display
  ├─ darwin.ts → click-through transparent BrowserWindow
  └─ win32.ts  → click-through transparent BrowserWindow
```

平台实现放在 `electron/displaySelectionOutline/{darwin,win32}.ts`，`index.ts` 只负责来源到 `Display` 的公共解析、平台分发和单实例生命周期。两个平台均创建覆盖目标显示器 bounds 的透明、无框、不可聚焦、鼠标穿透且置顶的 `BrowserWindow`；内容只绘制向内收口的主题橙色边框。

## 2. Data Model & Interfaces

新增两个白名单 IPC，不修改 `events.json`、录制会话或用户设置：

```typescript
interface RecorderApi {
  showDisplaySelectionOutline(sourceId: string): Promise<boolean>
  hideDisplaySelectionOutline(): Promise<void>
}
```

- `showDisplaySelectionOutline` 仅接受当前枚举得到的 `screen` source id。Main 使用最新 `desktopCapturer.getSources({ types: ['screen'] })` 查找 source，并以 `display_id` 匹配 `screen.getAllDisplays()`；成功显示返回 `true`，来源失效或无法映射返回 `false` 并清理旧边框。
- `hideDisplaySelectionOutline` 幂等；没有活动边框时直接完成。
- 覆盖窗口不持久化、不出现在任务栏/Dock/Alt+Tab/Command+Tab 中，也不接收键鼠输入。

## 3. Data Flow & Interaction

1. 用户点击整屏来源卡片，Renderer 保留既有卡片选中状态并请求 Main 显示物理边框。
2. Main 重新枚举屏幕来源，通过 `display_id` 精确取得物理 `Display.bounds`，销毁旧覆盖窗口并在目标显示器创建新窗口。
3. 用户改选另一屏时重复步骤 2；改选窗口来源时调用隐藏接口。
4. 若预览流获取失败，Renderer 清空有效选中反馈并隐藏边框。
5. 用户点击“开始录制”时，Renderer 首先 `await hideDisplaySelectionOutline()`，再复用/建立采集流并启动 Main 会话与 `MediaRecorder`。
6. 离开录制视图、主窗口关闭/隐藏、应用退出或显示器拓扑变化导致目标失效时，Main/Renderer 清理边框。

## 4. Visual Direction

- 使用 Lenza accent 色的稳定常亮描边，不显示文字、图标、遮罩或呼吸动效。
- 边框沿物理显示器四周向内绘制，保证在不同系统缩放与屏幕边缘均完整可见。
- 默认采用 6 个逻辑像素的主描边并辅以克制的半透明内侧光晕；深浅桌面背景均需清晰，但不得大面积遮挡内容。
- 覆盖层自身完全透明，边框之外不改变桌面颜色。

## 5. Error Handling

- **来源已失效或无法匹配 `display_id`**：不猜测显示器；隐藏旧边框并返回 `false`，来源卡片仍由既有预览获取流程处理错误。
- **覆盖窗口创建失败**：录制选择与采集流程继续可用；不把装饰反馈失败升级为录制阻断错误。
- **快速连续改选**：Main 以最后一次请求为准，销毁旧实例，确保最多存在一个覆盖窗口。
- **显示器拔出/分辨率改变**：监听 display removed/metrics changed；目标仍存在则更新 bounds，否则销毁。
- **开始录制时隐藏失败**：销毁操作保持幂等并在 Main 侧同步完成；Renderer 等待 IPC 返回后才进入录制启动路径。
