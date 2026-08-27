# Task Breakdown & Execution Board: 火山引擎云端高清 TTS

> 按依赖顺序执行；完成一项后勾选。实现前须由用户批准本变更 spec。

## Phase 1: 契约与安全存储

- [ ] Task 1.1: 扩展 `shared/` TTS provider、云端公共配置、凭据写入/清除/测试和分类错误契约，保证已保存 Key 无读取返回类型
- [ ] Task 1.2: 在 Main 新增 `safeStorage` 凭据模块，以 userData 专用 secret 文件原子保存密文、末四位和凭据修订；加密不可用时拒绝明文降级
- [ ] Task 1.3: 增加最小白名单 IPC/preload 方法并审计日志、错误序列化与设置持久化，确保明文 Key 只短暂经过输入框和一次性 IPC 入参

## Phase 2: 火山 provider 与缓存集成

- [ ] Task 2.1: 实现固定官方端点的 V3 SSE provider，支持 `X-Api-Key`、资源 ID、voice ID、请求取消、超时、响应 code 校验和 base64 音频解析
- [ ] Task 2.2: 将 provider 路由接入既有 TTS service；保留 local 默认路径，把云端音频转换到现有 WAV/PCM 时长贴合与组装管线
- [ ] Task 2.3: 扩展分段缓存身份，纳入 provider、资源 ID、voice ID、凭据修订与 provider 版本；用临时文件和原子发布保证部分失败不覆盖最终派生轨
- [ ] Task 2.4: 实现云端分类错误、无自动 provider 降级、取消/会话隔离和用户重试复用成功缓存段

## Phase 3: 设置与配音交互

- [ ] Task 3.1: 在设置页新增独立的火山引擎配置组件，提供 Key 密码输入、末四位状态、资源 ID、仅保存、替换、清除和测试连接
- [ ] Task 3.2: 在配音面板按“本地离线（默认）/火山引擎云端高清”分组，加入精选中英文音色、自定义 voice ID、未配置/离线/无权限状态
- [ ] Task 3.3: 实现版本化隐私同意与首次计费提示；测试连接披露固定文本，生成前统计并展示字幕段数和 Unicode 字符数
- [ ] Task 3.4: 复用现有生成进度、取消和错误展示；确保失败时保留已有派生轨并提供重试或手动切换本地入口

## Phase 4: 集成与文档

- [ ] Task 4.1: 为凭据存储、SSE 解析、缓存身份、字符统计、失败原子性和敏感信息脱敏增加可重复测试或独立 smoke 脚本
- [ ] Task 4.2: 更新 `docs/TECH_DESIGN.md`、kr-08 相关说明与 `sdd/project.md`，记录 provider 数据流、平台安全存储和外发边界
- [ ] Task 4.3: 检查所有新增/修改文件不超过 300 行，移除调试日志和未使用分支，并运行 `npm run typecheck`、lint 与 build
- [ ] Task 4.4: 按 `checklist.md` 完成 macOS 与 Windows 人工冒烟；全部通过后同步关闭本 change 状态

# Task Dependencies

- [Task 1.2] depends on [Task 1.1]
- [Task 1.3] depends on [Task 1.1] and [Task 1.2]
- [Task 2.1] depends on [Task 1.1] and [Task 1.2]
- [Task 2.2] depends on [Task 2.1]
- [Task 2.3] depends on [Task 2.2]
- [Task 2.4] depends on [Task 2.2] and [Task 2.3]
- [Task 3.1] depends on [Task 1.3] and [Task 2.1]
- [Task 3.2] depends on [Task 1.1] and [Task 2.2]
- [Task 3.3] depends on [Task 1.3], [Task 3.1], and [Task 3.2]
- [Task 3.4] depends on [Task 2.4], [Task 3.2], and [Task 3.3]
- [Task 3.1] and [Task 2.3] can run in parallel after their respective dependencies
- [Task 4.1] depends on [Task 2.4] and [Task 3.3]
- [Task 4.2] depends on [Task 3.4]
- [Task 4.3] depends on [Task 4.1] and [Task 4.2]
- [Task 4.4] depends on [Task 4.3]

