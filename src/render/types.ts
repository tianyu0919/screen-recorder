/**
 * WebGL 合成器配置与对外数据契约（Task 2.1–2.4）。
 * 本模块是纯渲染层：只依赖 WebGL 画布 + 帧源 + CameraState + 时间，
 * 不依赖 store / 实时时钟，预览（Phase 3）与 kr-03 Worker 离线导出共用。
 */

/** RGBA 颜色，分量 0..1（shader uniform 直传，不做 CSS 解析） */
export type Rgba = [number, number, number, number]

/** 输出画布逻辑分辨率（spec §4.1：输出视口 1920×1080） */
export interface OutputSize {
  width: number
  height: number
}

/** 纯色背景参数（仅在视频未铺满画布时可见） */
export interface BackgroundParams {
  color: Rgba
}

/** 视频画面样式；录制内容边缘保持原始矩形，不施加圆角或阴影。 */
export interface VideoStyleParams {
  paddingRatio: number
}

/** 点击波纹参数（Task 2.3） */
export interface RippleParams {
  /** 扩散时长（ms） */
  durationMs: number
  /** 最大半径（输出像素） */
  maxRadius: number
  /** 圆环软边宽度（输出像素） */
  ringWidth: number
  color: Rgba
}

/** 合成器完整配置（构造时可按组部分覆盖默认值） */
export interface CompositorOptions {
  output: OutputSize
  background: BackgroundParams
  videoStyle: VideoStyleParams
  ripple: RippleParams
  /** 同屏最大波纹数（超出时丢弃最旧的），上限见 shaders.ts 的 MAX_RIPPLES */
  maxRipples: number
}

export const DEFAULT_COMPOSITOR_OPTIONS: CompositorOptions = {
  output: { width: 1920, height: 1080 },
  background: {
    color: [22 / 255, 24 / 255, 29 / 255, 1]
  },
  videoStyle: {
    paddingRatio: 0
  },
  ripple: {
    durationMs: 700,
    maxRadius: 120,
    ringWidth: 14,
    color: [1, 1, 1, 0.55]
  },
  maxRipples: 8
}

/**
 * 波纹触发点：画布（视频像素）坐标 + 事件时间（ms，录制时间轴）。
 * 事件坐标换算（display→canvas）由调用方用 timeline/coords.displayToCanvas 完成，
 * 合成器只认画布坐标，保证与相机变换同一坐标系。
 */
export interface RipplePoint {
  t: number
  x: number
  y: number
}

/** 单帧可上传的帧源：预览用 HTMLVideoElement，kr-03 导出用 VideoFrame 直接喂纹理 */
export type FrameSource = TexImageSource

/** 已栅格化的按键提示层；rect 使用输出画布像素坐标。 */
export interface KeyOverlayFrame {
  source: FrameSource
  x: number
  y: number
  width: number
  height: number
  alpha: number
}

/**
 * 每帧渲染后返回/暴露给 UI 的信息（Task 2.4）。
 * UI 据此明示"输出分辨率变化 / 输入已降采样"，UI 接入属 Phase 3。
 */
export interface RenderInfo {
  /** 输出画布逻辑分辨率 */
  outputWidth: number
  outputHeight: number
  /** 源视频分辨率（物理像素） */
  sourceWidth: number
  sourceHeight: number
  /** 实际上传的纹理尺寸（降采样后） */
  textureWidth: number
  textureHeight: number
  /** 纹理相对源的降采样倍率（1 = 未降采样，<1 = 被缩小） */
  downsample: number
  /** 当前 GL 上下文的纹理尺寸上限 */
  textureLimit: number
  /** 源视频超过纹理上限被降采样（UI 应明示） */
  downsampled: boolean
}
