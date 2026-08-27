# Verification Checklist: 本地 TTS 配音

> 全部勾选后才允许把本 KR 标记为 completed。每项必须客观可验证。

## Functional Verification
- [x] 有录音会话：选音色 → 生成 → 预览听到 TTS 配音且 mic.wav 字节级未变（md5 一致）；一键切回原声立即生效（真实 App CDP 冒烟）
- [x] 无录音会话：手动字幕 → 生成配音 → 预览有声（用户实测 w8fpvr + CDP 副本冒烟），无字幕段区间为静音；导出同 mic 轨位逻辑
- [x] 无任何字幕段时禁止生成并提示先添加字幕（service 空段抛错 + UI 拦截，e2e 验证）
- [x] 超长段 +20% 内加速贴合后恰占字幕窗；超阈值段落按端点速率溢出且 UI 有标记；偏短段保持自然语速（service e2e：超窗段正确进 overflowSegmentIds；减速策略验收后修正为不对称）
- [x] 30 分钟会话派生轨与 mic.wav（或视频时长）等长（数据级验证：30.000min 精确等长，40 段缓存命中拼接 0.4s；有 mic 会话以 mic.wav 头部解析时长为准）；拼接边界听感留人耳抽听
- [x] 修改单条字幕文字 → 重生成仅变更段调引擎（缓存命中其余段）；仅拖动时间 → 零引擎调用（service e2e 两种场景均验证）
- [x] 切换音色全量重生成；切回原音色命中缓存（service e2e：换音色段缓存 2→4 全量合成，切回 0.0s 命中且 derivedFile 复原）
- [x] 生成中切换会话/回会话库，结果不串会话；退出应用有任务时确认取消，无半成品文件残留（任务按 sessionId 隔离；中途取消 e2e 验证：无 .tmp 残留、状态 cancelled；退出保护复用导出队列语义已接线 cancelAll）
- [x] TTS 启用时 mic 增益/静音/裁剪对派生轨生效（复用 mic 轨位零分支）；播放中热切换音源无声问题已修复（useSyncedAudio 立即接管）并 CDP 验证
- [x] 派生 WAV 删除或 derivedKey 失配 → 回退原声/静音 + 提示重生成（sessionReader 四场景验证；导出硬报错代码已审）
- [x] 导入自定义 sherpa-onnx 模型：合法模型入库可用、可合成（service e2e：probe→注册→试听→删除全链）；损坏模型拒绝并提示（缺 tokens.txt 等结构校验 + helper 探测双重拦截；UI 目录选择框已接线）
- [x] 官方音色全部从安装资源加载，不存在运行时下载 IPC/UI/临时目录；缺少或摘要错误的模型保持不可用且不影响其余编辑功能
- [x] 历史 V1/V2 edit.json 会话打开正常（TTS 关闭），保存后升级 V3（迁移五场景验证）
- [ ] 双平台同一模型同一文本合成时长一致（误差 <1ms）

## Code Quality
- [x] `npm run typecheck` 通过（node + web 两套）
- [x] lint 无新增告警（.agents/ 下 skill 工具的 5 个 error 为既有问题，非本次引入）；无调试日志/注释代码残留
- [x] 单文件 ≤300 行；平台差异仅在 `electron/tts/{darwin,win32}.ts`；helper 路径三处（native 构建 / electron-builder / electron 查找）一致
- [x] Renderer 平台判断只走 `window.api.platform`（TTS 链路无平台分支需求）

## Testing
- [x] macOS 冒烟：生成/增量重生成/试听/导出全链路（真实 App CDP 驱动 + 用户实测：含热切换修复验证、自然语速重生成、真实 MP4 导出音轨包络比对）
- [ ] Windows 人工冒烟：三套内置模型生成、预览与导出同上
- [x] 无 mic.wav 历史会话回归：编辑/播放/导出行为不变（w8fpvr 即无 mic 会话，TTS 关闭时行为与历史一致，导出产物正常）

## Non-Functional
- [x] 生成期间 UI 不卡（合成在 helper 子进程，组装在 Main 进程，Renderer 主线程无长任务）
- [x] 进度、取消、失败、溢出均有用户可读提示（进度条 + toast + ⚠ 标记 + 面板错误文案，无原始堆栈）
- [x] `docs/TECH_DESIGN.md` 与 `sdd/project.md` 已同步
