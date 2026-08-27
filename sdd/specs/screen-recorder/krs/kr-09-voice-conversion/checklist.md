# Verification Checklist: 本地音色转换

> 占位清单（二期）。进入实现前按澄清结论补齐可量化指标。

## Functional Verification
- [ ] mic 轨音色转换后韵律/节奏保留（主观听感评审通过），派生轨与原轨等长
- [ ] 复用 kr-08 语义：A/B 切换、增益/静音/裁剪一致、预览/专注预览/导出一致、派生丢失回退原声
- [ ] GPU 不可用机器自动 CPU 降级且不阻断编辑

## Code Quality
- [ ] typecheck / lint 通过，平台差异按 darwin/win32 拆分约定落地

## Testing
- [ ] macOS 与 Windows 人工冒烟通过；长会话（30 分钟）处理时长在澄清确定的阈值内

## Non-Functional
- [ ] 音色模型授权合规结论存档；模型不随包内置，按需下载
