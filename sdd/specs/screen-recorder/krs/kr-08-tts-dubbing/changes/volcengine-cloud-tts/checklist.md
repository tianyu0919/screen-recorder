# Verification Checklist: 火山引擎云端高清 TTS

> 本清单全部通过后才允许把 change 标记为 completed。

## Functional Verification

- [ ] 未配置 Key 或完全离线时，本地内置音色仍为默认且试听、生成、预览和导出正常
- [ ] 设置页可仅保存、替换、清除 Key；读取界面只显示配置状态和末四位
- [ ] 资源 ID 默认 `seed-tts-2.0` 且可修改，精选中英文音色和自定义 voice ID 均能生成
- [ ] “测试连接”使用固定短文本完成真实请求，成功可试听，失败保留配置并显示分类错误
- [ ] 首次测试和首次云端生成均在文本外发前显示准确披露并要求确认
- [ ] 云端生成持续显示准确的字幕段数和 Unicode 字符数，后续同版本同意不重复弹窗
- [ ] 生成结果复用既有 mic 轨位、时长贴合、预览、裁剪和 MP4 导出管线，三者听感与时间轴一致

## Security & Privacy

- [ ] 请求主机固定为 `openspeech.bytedance.com`，API Key 不可通过用户输入的 URL 发送到其他主机
- [ ] secret 文件只含 `safeStorage` 密文；`settings.json`、`edit.json`、缓存键、Renderer 持久化状态和日志均不含明文 Key
- [ ] Renderer 无读取已保存 Key 的 API；保存后输入框被清空，错误对象和网络日志不泄漏鉴权头
- [ ] `safeStorage.isEncryptionAvailable() === false` 时保存明确失败，磁盘没有明文回退文件
- [ ] 实际生成仅发送字幕文本和必要 TTS 参数，不读取或上传视频、`mic.wav`、系统音频或其他会话文件
- [ ] 清除 Key 后 secret 记录消失、凭据修订递增，云端生成恢复为需配置状态

## Cache, Failure & Recovery

- [ ] 相同 provider、文本、voice ID、资源 ID、凭据修订和 provider 版本重复生成时不发起重复请求
- [ ] 只修改字幕时间时复用原始云端段，只重跑贴合和组装
- [ ] 替换 Key、资源 ID、voice ID 或文本后不会误命中旧身份缓存
- [ ] 中途单段失败、SSE 损坏、超时、限流或取消不会发布不完整派生轨，也不会覆盖此前可用轨
- [ ] 云端失败不自动混入本地音色、不自动重试整个任务；用户重试只请求未命中的段
- [ ] 生成期间切换会话时，完成结果不会写入或显示在其他 `sessionId`

## Code Quality

- [ ] 凭据存储、SSE 解析、缓存身份、字符统计、失败原子性和脱敏测试通过
- [ ] `npm run typecheck` 通过
- [ ] lint 与 build 通过且无新增告警
- [ ] 新增或修改的单文件不超过 300 行，provider、secret store、UI 和纯数据处理职责分离
- [ ] 无调试日志、注释代码、明文密钥 fixture 或未使用的旧鉴权分支

## Cross-platform & Documentation

- [ ] macOS 完成保存/替换/清除、测试、精选/自定义音色、缓存、失败恢复、预览与导出冒烟
- [ ] Windows 完成等价冒烟，并确认系统安全存储及 userData secret 权限行为正常
- [ ] `docs/TECH_DESIGN.md` 记录固定端点、provider 路由、safeStorage、外发数据、缓存和失败策略
- [ ] `sdd/project.md` 与 kr-08 变更记录的状态、依赖和范围一致

