/**
 * src/render 冒烟验证（无测试框架，直接跑）：
 *   TSX_TSCONFIG_PATH=tsconfig.web.json npx -y tsx scripts/render.smoke.ts
 * 覆盖 Task 2.1–2.4 的纯数学部分（布局/仿射变换/波纹求值/降采样计算）。
 * 注意：shader/GL 绘制路径无法无头验证，需在 Phase 3 预览接入后人工目视确认。
 */
import { clampCameraToCanvas } from '../src/timeline/coords'
import type { CanvasSize } from '../src/timeline/types'
import {
  activeRipplesAt,
  cameraToOutputTransform,
  computeBasePlacement,
  fitTextureSize,
  rippleStateAt,
  transformPoint
} from '../src/render/layout'
import { DEFAULT_COMPOSITOR_OPTIONS, type RippleParams } from '../src/render/types'
import {
  MAX_FOCUS_PREVIEW_RENDER_SIZE,
  fitStageSize,
  previewRenderSize
} from '../src/lib/stageFit'
import { previewCompositorConfig } from '../src/components/preview/playbackRender'
import { hexToRgba, resolveOutputPlan } from '../src/render/outputPlan'

let failures = 0
function check(name: string, cond: boolean, detail = '') {
  if (cond) console.log(`ok   ${name}`)
  else {
    failures++
    console.error(`FAIL ${name} ${detail}`)
  }
}

const output = { width: 1920, height: 1080 }
const padRatio = DEFAULT_COMPOSITOR_OPTIONS.videoStyle.paddingRatio
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps

// ── 编辑器舞台自适应与预览 backing 降档 ──
const fitNarrow = fitStageSize({ width: 1000, height: 800 }, output)
check('舞台窄高时按宽度适配', fitNarrow.width === 1000 && fitNarrow.height === 562)
const fitWide = fitStageSize({ width: 1800, height: 700 }, output)
check('舞台宽矮时按高度适配', fitWide.width === 1244 && fitWide.height === 700)
const fitExact = fitStageSize(output, output)
check('舞台与输出同尺寸时保持 100%', fitExact.width === 1920 && fitExact.height === 1080)
const fitEmpty = fitStageSize({ width: 0, height: 700 }, output)
check('舞台未测量时不产生非法尺寸', fitEmpty.width === 0 && fitEmpty.height === 0)
const previewSmall = previewRenderSize({ width: 900, height: 506 }, output)
check('小舞台预览按 64px 宽度桶化', previewSmall.width === 960 && previewSmall.height === 540)
const previewLarge = previewRenderSize(output, output)
check('大舞台预览最高限制为 720p', previewLarge.width === 1280 && previewLarge.height === 720)
const focus1080 = previewRenderSize(
  { width: 1280, height: 720 },
  output,
  MAX_FOCUS_PREVIEW_RENDER_SIZE,
  64,
  2
)
check('Retina 专注预览按输出上限提升至 1080p', focus1080.width === 1920 && focus1080.height === 1080)
const focus2k = previewRenderSize(
  { width: 1280, height: 720 },
  { width: 3840, height: 2160 },
  MAX_FOCUS_PREVIEW_RENDER_SIZE,
  64,
  2
)
check('4K 输出的 Retina 专注预览最高限制为 2K', focus2k.width === 2560 && focus2k.height === 1440)
const previewEmpty = previewRenderSize({ width: 0, height: 0 }, output)
check('未测量舞台不创建预览 backing', previewEmpty.width === 0 && previewEmpty.height === 0)
const previewConfig = previewCompositorConfig(previewLarge, {
  background: { color: hexToRgba('#16181D') },
  videoStyle: { paddingRatio: 0 }
})
check(
  '预览纹理限制为 backing 长边 1.5 倍且不报告主动降档',
  previewConfig.textureLimit === 1920 && previewConfig.reportTextureDownsample === false
)

// ── Task 2.1: 基准摆放（等比缩放居中 + padding） ───────────────
const canvas: CanvasSize = { width: 2560, height: 1440 }
const pl = computeBasePlacement(canvas, output, padRatio)
const pad = Math.min(output.width, output.height) * padRatio // 64.8
// padding 按短边统一取值后内区为 1790.4×950.4（比例 1.884 > 16:9），高度侧先吃满
check(
  '2.1 基准摆放等比缩放并留出 padding',
  near(pl.height, output.height - pad * 2) &&
    near(pl.width, (pl.height * canvas.width) / canvas.height) &&
    pl.x >= pad,
  JSON.stringify(pl)
)
check(
  '2.1 基准摆放居中',
  near(pl.x, (output.width - pl.width) / 2) && near(pl.y, (output.height - pl.height) / 2)
)
// 竖屏源：高度吃满，横向 letterbox
const tall = computeBasePlacement({ width: 1080, height: 1920 }, output, 0)
check(
  '2.1 非 16:9 源按短边适配（letterbox）',
  near(tall.height, output.height) && tall.width < output.width && near(tall.y, 0),
  JSON.stringify(tall)
)

// ── Task 2.1: 相机仿射变换 ─────────────────────────────────────
const fullCam = { x: canvas.width / 2, y: canvas.height / 2, zoom: 1 }
const t1 = cameraToOutputTransform(fullCam, canvas, pl, output)
// zoom=1 全景：画布四角映射到基准摆放矩形四角
const c00 = transformPoint(t1, 0, 0)
const c11 = transformPoint(t1, canvas.width, canvas.height)
check(
  '2.1 zoom=1 全景 = 基准摆放',
  near(c00.x, pl.x) && near(c00.y, pl.y) && near(c11.x, pl.x + pl.width) && near(c11.y, pl.y + pl.height),
  `c00=${JSON.stringify(c00)} c11=${JSON.stringify(c11)}`
)

// zoom=2 对准点击点：该画布点映射到输出中心
const clickCam = clampCameraToCanvas({ x: 640, y: 360, zoom: 2 }, canvas)
const t2 = cameraToOutputTransform(clickCam, canvas, pl, output)
const center2 = transformPoint(t2, clickCam.x, clickCam.y)
check(
  '2.1 zoom=2 相机对准点落在输出中心',
  near(center2.x, output.width / 2) && near(center2.y, output.height / 2),
  JSON.stringify(center2)
)
check('2.1 zoom=2 变换 scale = baseScale × 2', near(t2.scale, t1.scale * 2))

// 钳制保护：边缘点击 + zoom 后，视频边缘露出的背景带 ≤ zoom=1 的摆放边距。
const edgeCam = clampCameraToCanvas({ x: 0, y: 0, zoom: 2 }, canvas)
const te = cameraToOutputTransform(edgeCam, canvas, pl, output)
const v00 = transformPoint(te, 0, 0) // 视频左上角在输出中的位置
check(
  '2.1 边缘点击钳制后背景露出 ≤ 摆放边距',
  near(v00.x, pl.x) && near(v00.y, pl.y),
  JSON.stringify(v00)
)

// ── Task 2.2: 真实边缘 + 可选纯色背景 ──────────────────────────
check(
  '2.2 默认合成器不加留白且使用纯色底',
  DEFAULT_COMPOSITOR_OPTIONS.background.color.length === 4 &&
    DEFAULT_COMPOSITOR_OPTIONS.videoStyle.paddingRatio === 0
)
const sourcePlan = resolveOutputPlan(
  { width: 3456, height: 2234 },
  { backgroundEnabled: false, backgroundColor: '#16181D', backgroundPaddingPercent: 6 }
)
check('2.2 背景关闭按源尺寸输出', sourcePlan.output.width === 3456 && sourcePlan.output.height === 2234 && sourcePlan.paddingRatio === 0)
const backgroundPlan = resolveOutputPlan(
  { width: 3456, height: 2234 },
  { backgroundEnabled: true, backgroundColor: '#ffffff', backgroundPaddingPercent: 6 }
)
check('2.2 背景开启使用 1080p 画布与规范色', backgroundPlan.output.width === 1920 && backgroundPlan.output.height === 1080 && backgroundPlan.backgroundColor === '#FFFFFF' && backgroundPlan.paddingRatio > 0)
check('2.2 默认背景边距换算为 6%', near(backgroundPlan.paddingRatio, 0.06))
const zeroPaddingPlan = resolveOutputPlan(
  { width: 1920, height: 1080 },
  { backgroundEnabled: true, backgroundColor: '#16181D', backgroundPaddingPercent: 0 }
)
check('2.2 背景边距支持 0%', zeroPaddingPlan.paddingRatio === 0)
const maxPaddingPlan = resolveOutputPlan(
  { width: 1920, height: 1080 },
  { backgroundEnabled: true, backgroundColor: '#16181D', backgroundPaddingPercent: 20 }
)
check('2.2 背景边距支持 20%', near(maxPaddingPlan.paddingRatio, 0.2))
const clampedPaddingPlan = resolveOutputPlan(
  { width: 1920, height: 1080 },
  { backgroundEnabled: true, backgroundColor: '#16181D', backgroundPaddingPercent: 50 }
)
check('2.2 背景边距越界时钳制', near(clampedPaddingPlan.paddingRatio, 0.2))
const fallbackPlan = resolveOutputPlan(
  { width: 5000, height: 3000 },
  { backgroundEnabled: false, backgroundColor: '#16181D', backgroundPaddingPercent: 6 },
  { width: 2560, height: 1440 }
)
check('2.2 编码降档保持比例并归一偶数尺寸', fallbackPlan.downscaled && fallbackPlan.output.width === 2400 && fallbackPlan.output.height === 1440)

// ── Task 2.3: 波纹时间求值 ─────────────────────────────────────
const rp: RippleParams = DEFAULT_COMPOSITOR_OPTIONS.ripple
check('2.3 触发前无波纹', rippleStateAt(-1, rp) === null)
check('2.3 超时后无波纹', rippleStateAt(rp.durationMs + 1, rp) === null)
const s0 = rippleStateAt(0, rp)!
const sMid = rippleStateAt(rp.durationMs / 2, rp)!
const sEnd = rippleStateAt(rp.durationMs, rp)!
check(
  '2.3 半径单调扩散 0 → maxRadius',
  s0.radius === 0 && sMid.radius > s0.radius && near(sEnd.radius, rp.maxRadius),
  `mid=${sMid.radius}`
)
check(
  '2.3 alpha 线性淡出至 0',
  near(s0.alpha, rp.color[3]) && sMid.alpha < s0.alpha && sEnd.alpha === 0
)

// 活动波纹过滤：时间窗外（过早/未来）的点击被剔除，坐标映射到输出空间
const clicks = [
  { t: 1000, x: 1280, y: 720 }, // 画布中心
  { t: 100, x: 0, y: 0 }, // 已超出时间窗
  { t: 1300, x: 640, y: 360 }
]
const act = activeRipplesAt(clicks, 1400, rp, t1, 8)
check(
  '2.3 时间窗过滤（仅 2 个活动波纹）',
  act.length === 2 && near(act[0].x, output.width / 2) && near(act[0].y, output.height / 2),
  JSON.stringify(act)
)
// 数量上限：保留最新的
const many = Array.from({ length: 20 }, (_, i) => ({ t: 1000 + i * 10, x: 0, y: 0 }))
const capped = activeRipplesAt(many, 1150, { ...rp, durationMs: 500 }, t1, 8)
check(
  '2.3 超上限保留最新 8 个',
  capped.length === 8,
  `got ${capped.length}`
)

// ── Task 2.4: 超纹理上限降采样计算 ─────────────────────────────
const noDs = fitTextureSize(1920, 1080, 16384)
check('2.4 上限内不降采样', noDs.scale === 1 && noDs.width === 1920 && noDs.height === 1080)
// 8K 源 → 上限 4096：等比缩小，最长边 = 上限
const ds = fitTextureSize(7680, 4320, 4096)
check(
  '2.4 超限等比降采样（最长边=上限）',
  ds.width === 4096 && ds.height === 2304 && near(ds.scale, 4096 / 7680),
  JSON.stringify(ds)
)
// 极端宽源：按最长边缩，另一维不低于 1
const wide = fitTextureSize(20000, 10, 8192)
check('2.4 极端宽高比降采样不塌缩', wide.width === 8192 && wide.height >= 1, JSON.stringify(wide))

console.log(failures === 0 ? '\n全部通过' : `\n${failures} 项失败`)
process.exit(failures === 0 ? 0 : 1)
