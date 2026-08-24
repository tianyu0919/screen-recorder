import { fitTextureSize } from './layout'
import type { FrameSource } from './types'

/**
 * 纹理上传与降采样（Task 2.4），与绘制逻辑解耦：
 * 只负责"帧源 → GPU 纹理"，不关心相机/波纹如何采样它。
 * 帧源接受 HTMLVideoElement（预览）/ VideoFrame（kr-03 导出逐帧喂）/ ImageBitmap 等
 * 任意 TexImageSource；降采样中间画布用 OffscreenCanvas，Worker 环境同样可用。
 */

/** 一次上传的结果信息（并入 compositor 的 RenderInfo 暴露给 UI） */
export interface TextureUploadInfo {
  sourceWidth: number
  sourceHeight: number
  textureWidth: number
  textureHeight: number
  /** 降采样倍率（1 = 未降采样） */
  downsample: number
  downsampled: boolean
}

/** 取帧源像素尺寸（VideoFrame 用 coded 尺寸，与解码输出一致） */
export function getSourceSize(source: FrameSource): { width: number; height: number } {
  if (typeof VideoFrame !== 'undefined' && source instanceof VideoFrame) {
    return { width: source.codedWidth, height: source.codedHeight }
  }
  if (typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement) {
    return { width: source.videoWidth, height: source.videoHeight }
  }
  const s = source as { width: number; height: number }
  return { width: s.width, height: s.height }
}

/** 单个可复用上传纹理：尺寸变化时重分配，否则原地 texSubImage2D 更新 */
export class VideoTexture {
  readonly texture: WebGLTexture
  readonly limit: number
  private gl: WebGL2RenderingContext
  private scratch: OffscreenCanvas | null = null
  private texWidth = 0
  private texHeight = 0

  constructor(gl: WebGL2RenderingContext, limit?: number) {
    this.gl = gl
    this.limit = limit ?? gl.getParameter(gl.MAX_TEXTURE_SIZE)
    const texture = gl.createTexture()
    if (!texture) throw new Error('创建纹理失败')
    this.texture = texture
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }

  /** 上传一帧；源超过纹理上限时先经 OffscreenCanvas 等比降采样 */
  upload(source: FrameSource): TextureUploadInfo {
    const { width: sw, height: sh } = getSourceSize(source)
    const fit = fitTextureSize(sw, sh, this.limit)
    let payload: FrameSource = source
    if (fit.scale < 1) {
      payload = this.downscale(source, fit.width, fit.height)
    }
    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    if (fit.width !== this.texWidth || fit.height !== this.texHeight) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, payload)
      this.texWidth = fit.width
      this.texHeight = fit.height
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, payload)
    }
    return {
      sourceWidth: sw,
      sourceHeight: sh,
      textureWidth: fit.width,
      textureHeight: fit.height,
      downsample: fit.scale,
      downsampled: fit.scale < 1
    }
  }

  private downscale(source: FrameSource, w: number, h: number): OffscreenCanvas {
    if (!this.scratch) this.scratch = new OffscreenCanvas(w, h)
    if (this.scratch.width !== w || this.scratch.height !== h) {
      this.scratch.width = w
      this.scratch.height = h
    }
    const ctx = this.scratch.getContext('2d')
    if (!ctx) throw new Error('OffscreenCanvas 2d 上下文不可用')
    // 帧源可能带透明区（窗口录制固定画布的留白）：复用画布前必须清除，
    // 否则 source-over 会把上一帧内容留在透明区里（预览残影）
    ctx.clearRect(0, 0, w, h)
    // TexImageSource 含 ImageData（非 CanvasImageSource），实际帧源不会是它
    ctx.drawImage(source as CanvasImageSource, 0, 0, w, h)
    return this.scratch
  }

  dispose(): void {
    this.gl.deleteTexture(this.texture)
    this.scratch = null
  }
}
