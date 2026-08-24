# Design: 编辑预览清晰度与性能提醒

## 1. Architecture

本变更只改变 Renderer 的实时预览 backing 和本机应用设置，不改变源视频、`edit.json` 或导出管线。

```text
AppSettingsStore (Main, settings.json)
        ↕ Settings IPC / preload whitelist
settingsStore (Renderer)
        ├─ PreviewLayoutControls：选择清晰度
        └─ PreviewPlayer：解析质量档 → previewRenderSize
                              ↓
                      usePlayback / rVFC
                              ↓ sustained degradation
                   shadcn Sonner Toast (top-center)
                    ├─ 切换到流畅 → settingsStore
                    └─ 保持当前 → 当前会话内抑制
```

会话库的时长徽标只调整 `SessionCard` 的视觉样式，与清晰度状态和性能监控解耦。

## 2. Data Model & Interfaces

```typescript
export type PreviewQualityMode = 'auto' | 'smooth' | 'high' | 'ultra'

export interface AppSettings {
  version: 2
  // existing fields...
  previewQuality: PreviewQualityMode
}

export interface PreviewQualityProfile {
  pixelRatio: number
  maxSize: { width: number; height: number }
}
```

- `settings.json` 继续使用 V2；旧文件缺少字段或字段非法时安全回退为 `auto`。
- `updateSettings` 的共享类型、Main 白名单、preload 白名单和 Renderer store 同步加入 `previewQuality`。
- 质量档解析保持纯函数，输入为模式与 `devicePixelRatio`：
  - `auto`：使用实际 DPR（钳制 `1–2`），最高 `1920×1080`；DPR 小于 `1.5` 时最高按 `1280×720`，避免普通屏无收益升档。
  - `smooth`：`1x`，最高 `1280×720`。
  - `high`：最高 `1.5x`，最高 `1920×1080`。
  - `ultra`：最高 `2x`，最高 `2560×1440`。
- `previewRenderSize` 继续以舞台 CSS 尺寸、输出尺寸、像素比、模式上限和 64px 宽度桶共同计算 backing，不超过最终输出尺寸。
- 专注预览保持既有 DPR 与 `2560×1440` 上限，不受普通编辑清晰度选项影响。

## 3. Data Flow & Interaction

1. 应用启动时 Main 读取并规范化 `previewQuality`，Renderer 的 `settingsStore` 获取全局设置。
2. 用户在编辑工具栏的清晰度 Select 中选择档位；Renderer 乐观更新，经现有 Settings IPC 原子写入 `settings.json`。
3. `PreviewPlayer` 根据当前档位和 DPR 计算 profile，再调用 `previewRenderSize`；只有桶化后的 backing 尺寸改变时才重建合成器。
4. 普通编辑模式播放时，rVFC 将回调时间交给纯性能监控器；暂停、seek、裁剪跳转、时长探针、页面隐藏、专注预览或清晰度为流畅时重置且不检测。
5. 每次连续播放先预热 3 秒，再统计 2 秒窗口。实际回调帧率低于源视频帧率的 70% 时，向上层报告一次性能问题。
6. App 根节点挂载通过 shadcn CLI 添加的 Sonner `Toaster`，位置为 `top-center`。性能问题触发 warning Toast：
   - “切换到流畅”将全局 `previewQuality` 更新为 `smooth` 并关闭 Toast。
   - “保持当前清晰度”只抑制当前已打开会话后续提醒；重新打开会话后可再次检测。
7. `SessionCard` 移除缩略图上的时长浮层，将等宽时长标签放在卡片正文的会话 ID 行右侧；标签使用语义表面、边框和高对比文字，不再受截图内容影响。

逐帧采样计数、窗口起点、预热时间和抑制状态使用 ref 或纯对象保存；只有触发 Toast 时跨入 React 状态/回调，不在 60fps 路径中持续 `setState`。

## 4. Error Handling

- **设置缺失或损坏**：Main 解析时回退 `auto`，不阻断应用启动，也不升级设置版本。
- **保存设置失败**：沿用 `settingsStore` 的乐观更新回滚和用户可读错误；当前合成器恢复上一档。
- **短暂掉帧**：3 秒预热和 2 秒统计窗口过滤初始化、seek 与偶发尖峰；任何不连续播放边界都重置采样。
- **后台限帧**：`document.visibilityState !== 'visible'` 时不采样，回到前台重新预热。
- **Toast 重复**：每个打开会话最多保留一个稳定 Toast id；用户选择保持后在该次会话生命周期内不再提示。
- **源 FPS 无效**：无法取得有限正数 FPS 时不启用卡顿判断，预览继续正常工作。
- **shadcn 组件接入**：必须使用 `npx shadcn@latest add sonner` 生成组件，再以 Lenza 语义 token 适配深浅主题、焦点和按钮对比度。
