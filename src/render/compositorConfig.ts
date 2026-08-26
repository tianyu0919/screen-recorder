import { DEFAULT_COMPOSITOR_OPTIONS, type CompositorOptions } from './types'

/** 构造配置：各参数组可部分覆盖默认值。 */
export type CompositorConfig = Partial<
  Omit<CompositorOptions, 'background' | 'videoStyle' | 'ripple'>
> & {
  background?: Partial<CompositorOptions['background']>
  videoStyle?: Partial<CompositorOptions['videoStyle']>
  ripple?: Partial<CompositorOptions['ripple']>
  /** 预览可主动限制上传纹理尺寸；导出省略时使用 GPU MAX_TEXTURE_SIZE。 */
  textureLimit?: number
  /** 主动预览降档不作为硬件限制警告展示。 */
  reportTextureDownsample?: boolean
}

export function mergeCompositorOptions(config: CompositorConfig): CompositorOptions {
  const defaults = DEFAULT_COMPOSITOR_OPTIONS
  return {
    output: { ...defaults.output, ...config.output },
    background: { ...defaults.background, ...config.background },
    videoStyle: { ...defaults.videoStyle, ...config.videoStyle },
    ripple: { ...defaults.ripple, ...config.ripple },
    maxRipples: config.maxRipples ?? defaults.maxRipples
  }
}
