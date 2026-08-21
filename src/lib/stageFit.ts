export interface StageSize {
  width: number
  height: number
}

export type PreviewScaleMode = 'fit' | 'actual'

export const MAX_PREVIEW_RENDER_SIZE: StageSize = { width: 1280, height: 720 }

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
 * 预览 backing 分辨率：不超过舞台所需尺寸和 720p，并按宽度桶化。
 * CSS 尺寸仍由 fitStageSize 连续变化；桶化避免拖动窗口时逐像素重建 WebGL 合成器。
 */
export function previewRenderSize(
  display: StageSize,
  output: StageSize,
  maxSize: StageSize = MAX_PREVIEW_RENDER_SIZE,
  widthStep = 64
): StageSize {
  if (
    display.width <= 0 ||
    display.height <= 0 ||
    output.width <= 0 ||
    output.height <= 0 ||
    maxSize.width <= 0 ||
    maxSize.height <= 0
  ) {
    return { width: 0, height: 0 }
  }
  const desiredScale = Math.min(
    1,
    display.width / output.width,
    display.height / output.height
  )
  const maxScale = Math.min(1, maxSize.width / output.width, maxSize.height / output.height)
  const steppedWidth = Math.ceil((output.width * desiredScale) / widthStep) * widthStep
  const scale = Math.min(maxScale, Math.max(widthStep / output.width, steppedWidth / output.width))
  return {
    width: Math.max(1, Math.round(output.width * scale)),
    height: Math.max(1, Math.round(output.height * scale))
  }
}
