# Tasks: 时间轴编辑

- [x] 滚轮锚点缩放（指数连续曲线，≤12x）+ 横滑/拖动平移 + 隐藏滚动条 + 防文字选中
- [x] 播放头死区缓动跟随 + 1.5s 用户接管期
- [x] zoomOverrides：previewStore 派生叠加，合并片段整段覆盖（timeline/segments.ts 共享规则）
- [x] 检查器「选中片段」区（片段倍率滑杆 + 恢复全局值）；时间轴片段选中/高亮
- [x] timeline/cuts.ts：normalizeCuts / cutAt / sourceToOutputMs / outputToSourceMs / effectiveDurationMs
- [x] 裁剪交互：刻度尺框选、拖边/移动、确认/放弃、「编辑此段」回退选区；pointer capture 吞 click 修复
- [x] 预览跳过：播放中 seek 跳过（skippingRef 守卫防连续 seek 卡死）、暂停态吸附、尾部裁剪停在保留段最后一帧
- [x] 导出映射：ExportStartMessage.cuts、pipeline 逐帧 outputToSourceMs、cutPcm 音频拼接、时长=裁剪后
- [x] 刻度尺：首尾锚定 + 中间按密度分配 + 防越界/防重名
- [x] 真实时长探针（probingRef，加载即解析）+ onEnded 校正兜底
- [x] 检查器裁剪列表（CutsPanel）；docs/TECH_DESIGN.md §4.4 同步
- [x] npm run typecheck / build 通过
