import type { PreviewQualityMode } from '@shared/types'

export interface StageSize {
  width: number
  height: number
}

export type PreviewScaleMode = 'fit' | 'actual'

export const MAX_PREVIEW_RENDER_SIZE: StageSize = { width: 1280, height: 720 }
export const MAX_HIGH_PREVIEW_RENDER_SIZE: StageSize = { width: 1920, height: 1080 }
export const MAX_FOCUS_PREVIEW_RENDER_SIZE: StageSize = { width: 2560, height: 1440 }

export interface PreviewQualityProfile {
  pixelRatio: number
  maxSize: StageSize
}

/** 普通编辑预览质量档；手动档允许超采样，自动档跟随当前显示器 DPR。 */
export function previewQualityProfile(
  mode: PreviewQualityMode,
  devicePixelRatio: number
): PreviewQualityProfile {
  const dpr = Number.isFinite(devicePixelRatio)
    ? Math.min(2, Math.max(1, devicePixelRatio))
    : 1
  if (mode === 'smooth') return { pixelRatio: 1, maxSize: MAX_PREVIEW_RENDER_SIZE }
  if (mode === 'high') return { pixelRatio: 1.5, maxSize: MAX_HIGH_PREVIEW_RENDER_SIZE }
  if (mode === 'ultra') return { pixelRatio: 2, maxSize: MAX_FOCUS_PREVIEW_RENDER_SIZE }
  return {
    pixelRatio: dpr,
    maxSize: dpr >= 1.5 ? MAX_HIGH_PREVIEW_RENDER_SIZE : MAX_PREVIEW_RENDER_SIZE
  }
}

/** 将固定宽高比画布完整、等比地放进舞台可用区域。 */
export function fitStageSize(available: StageSize, output: StageSize): StageSize {
  if (
    available.width <= 0 ||
    available.height <= 0 ||
    output.width <= 0 ||
    output.height <= 0
  ) {
    return { width: 0, height: 0 }
  }
  const scale = Math.min(available.width / output.width, available.height / output.height)
  return {
    width: Math.max(1, Math.floor(output.width * scale)),
    height: Math.max(1, Math.floor(output.height * scale))
  }
}

/**
 * 预览 backing 分辨率：不超过显示所需物理像素、输出尺寸和模式上限，并按宽度桶化。
 * CSS 尺寸仍由 fitStageSize 连续变化；桶化避免拖动窗口时逐像素重建 WebGL 合成器。
 */
export function previewRenderSize(
  display: StageSize,
  output: StageSize,
  maxSize: StageSize = MAX_PREVIEW_RENDER_SIZE,
  widthStep = 64,
  pixelRatio = 1
): StageSize {
  if (
    display.width <= 0 ||
    display.height <= 0 ||
    output.width <= 0 ||
    output.height <= 0 ||
    maxSize.width <= 0 ||
    maxSize.height <= 0 ||
    pixelRatio <= 0
  ) {
    return { width: 0, height: 0 }
  }
  const desiredScale = Math.min(
    1,
    (display.width * pixelRatio) / output.width,
    (display.height * pixelRatio) / output.height
  )
  const maxScale = Math.min(1, maxSize.width / output.width, maxSize.height / output.height)
  const steppedWidth = Math.ceil((output.width * desiredScale) / widthStep) * widthStep
  const scale = Math.min(maxScale, Math.max(widthStep / output.width, steppedWidth / output.width))
  return {
    width: Math.max(1, Math.round(output.width * scale)),
    height: Math.max(1, Math.round(output.height * scale))
  }
}
