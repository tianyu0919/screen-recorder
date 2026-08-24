import type { CompositorConfig } from '@/render/compositor'
import type { CanvasSize } from '@/timeline/types'
import type { RenderInfo } from '@/render/types'

/** 保持与 1080p 导出一致的相对视觉尺寸，只降低预览像素成本。 */
export function previewCompositorConfig(
  output: CanvasSize,
  style: Pick<CompositorConfig, 'background' | 'videoStyle'>
): CompositorConfig {
  const scale = Math.min(
    output.width / 1920,
    output.height / 1080
  )
  return {
    output,
    // 为放大预览保留 1.5x 像素余量，同时避免 2K/4K 原帧逐帧完整上传。
    textureLimit: Math.max(output.width, output.height) * 1.5,
    reportTextureDownsample: false,
    background: style.background,
    videoStyle: style.videoStyle,
    ripple: {
      maxRadius: 120 * scale,
      ringWidth: 14 * scale
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
