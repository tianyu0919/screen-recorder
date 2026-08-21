import { DEFAULT_COMPOSITOR_OPTIONS } from '@/render/types'
import type { CompositorConfig } from '@/render/compositor'
import type { CanvasSize } from '@/timeline/types'
import type { RenderInfo } from '@/render/types'

/** 保持与 1080p 导出一致的相对视觉尺寸，只降低预览像素成本。 */
export function previewCompositorConfig(output: CanvasSize): CompositorConfig {
  const defaults = DEFAULT_COMPOSITOR_OPTIONS
  const scale = Math.min(
    output.width / defaults.output.width,
    output.height / defaults.output.height
  )
  return {
    output,
    // 为放大预览保留 1.5x 像素余量，同时避免 2K/4K 原帧逐帧完整上传。
    textureLimit: Math.max(output.width, output.height) * 1.5,
    reportTextureDownsample: false,
    videoStyle: {
      cornerRadius: defaults.videoStyle.cornerRadius * scale,
      shadow: {
        ...defaults.videoStyle.shadow,
        blur: defaults.videoStyle.shadow.blur * scale,
        offsetY: defaults.videoStyle.shadow.offsetY * scale
      }
    },
    ripple: {
      maxRadius: defaults.ripple.maxRadius * scale,
      ringWidth: defaults.ripple.ringWidth * scale
    }
  }
}

/** RenderInfo 通常整段播放不变，避免为同值对象逐帧触发 React 更新。 */
export function sameRenderInfo(a: RenderInfo | null, b: RenderInfo): boolean {
  return (
    a !== null &&
    a.outputWidth === b.outputWidth &&
    a.outputHeight === b.outputHeight &&
    a.sourceWidth === b.sourceWidth &&
    a.sourceHeight === b.sourceHeight &&
    a.textureWidth === b.textureWidth &&
    a.textureHeight === b.textureHeight &&
    a.downsample === b.downsample &&
    a.textureLimit === b.textureLimit &&
    a.downsampled === b.downsampled
  )
}
