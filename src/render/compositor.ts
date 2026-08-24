import type { CameraState } from '@shared/types'
import type { CanvasSize } from '../timeline/types'
import {
  activeRipplesAt,
  cameraToOutputTransform,
  computeBasePlacement
} from './layout'
import {
  BG_FRAG_SRC,
  MAX_RIPPLES,
  RIPPLE_FRAG_SRC,
  VIDEO_FRAG_SRC,
  createProgram
} from './shaders'
import { VideoTexture } from './texture'
import { KeyOverlayPass } from './keyOverlayPass'
import {
  DEFAULT_COMPOSITOR_OPTIONS,
  type CompositorOptions,
  type FrameSource,
  type KeyOverlayFrame,
  type RenderInfo,
  type RipplePoint,
  type Rgba
} from './types'

/**
 * WebGL 合成器主类（Task 2.1–2.4）。
 * 纯渲染模块：drawFrame(帧源, 相机, 时间, 点击点) 一入一画，无 store / 实时时钟依赖；
 * 构造接受 HTMLCanvasElement（预览）或 OffscreenCanvas（kr-03 Worker 离线导出）。
 * 合成顺序：纯色底 → 保持原始矩形边缘的视频画面 → 点击波纹。
 */

export class CompositorError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CompositorError'
  }
}

/** 构造配置：各参数组可部分覆盖默认值 */
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

interface ProgramSlots {
  program: WebGLProgram
  uniforms: Map<string, WebGLUniformLocation>
}

export class Compositor {
  private gl: WebGL2RenderingContext
  private options: CompositorOptions
  private canvasSize: CanvasSize | null = null
  private texture: VideoTexture
  private bg: ProgramSlots
  private video: ProgramSlots
  private ripple: ProgramSlots
  private keyOverlay: KeyOverlayPass
  private quad: WebGLBuffer
  private info: RenderInfo | null = null
  private reportTextureDownsample: boolean

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas, config: CompositorConfig = {}) {
    this.options = mergeOptions(config)
    canvas.width = this.options.output.width
    canvas.height = this.options.output.height
    const gl = (canvas as HTMLCanvasElement).getContext('webgl2', {
      alpha: false,
      antialias: false,
      // kr-03 需在渲染后从画布取帧（VideoFrame/readPixels），保留绘制缓冲
      preserveDrawingBuffer: true
    })
    if (!gl) throw new CompositorError('WebGL2 上下文不可用')
    this.gl = gl

    this.quad = createQuadBuffer(gl)
    this.bg = makeSlots(gl, BG_FRAG_SRC, ['u_output', 'u_color'])
    this.video = makeSlots(gl, VIDEO_FRAG_SRC, [
      'u_tex',
      'u_output',
      'u_canvasSize',
      'u_scale',
      'u_offset',
      'u_clipRect'
    ])
    this.ripple = makeSlots(gl, RIPPLE_FRAG_SRC, [
      'u_output',
      'u_count',
      'u_rippleGeom',
      'u_rippleAlpha',
      'u_color',
      'u_ringWidth'
    ])
    this.texture = new VideoTexture(gl, config.textureLimit)
    this.keyOverlay = new KeyOverlayPass(gl)
    this.reportTextureDownsample = config.reportTextureDownsample ?? true
  }

  /** 视频源分辨率（画布坐标系基准），会话加载后调用一次 */
  setCanvasSize(size: CanvasSize): void {
    this.canvasSize = { ...size }
  }

  /**
   * 渲染一帧。
   * @param source 帧源（HTMLVideoElement / VideoFrame / ImageBitmap 等）
   * @param camera 该时刻相机状态（spring.ts 求值结果，调用方负责钳制）
   * @param tMs 当前时间（录制时间轴 ms，用于波纹求值）
   * @param clicks 波纹触发点（画布坐标 + 触发时间）
   * @returns RenderInfo（Task 2.4：输出分辨率 / 降采样明示数据）
   */
  drawFrame(
    source: FrameSource,
    camera: CameraState,
    tMs: number,
    clicks: readonly RipplePoint[] = [],
    keyOverlay: KeyOverlayFrame | null = null
  ): RenderInfo {
    if (!this.canvasSize) throw new CompositorError('未设置画布尺寸：先调用 setCanvasSize')
    const gl = this.gl
    const { output, background, videoStyle, ripple } = this.options
    const tex = this.texture.upload(source)
    const placement = computeBasePlacement(this.canvasSize, output, videoStyle.paddingRatio)
    const transform = cameraToOutputTransform(camera, this.canvasSize, placement, output)

    gl.viewport(0, 0, output.width, output.height)

    // 1) 纯色底（背景关闭时视频以零留白完整覆盖）。
    gl.disable(gl.BLEND)
    gl.useProgram(this.bg.program)
    this.bindQuad()
    gl.uniform2f(this.u(this.bg, 'u_output'), output.width, output.height)
    gl.uniform4fv(this.u(this.bg, 'u_color'), background.color)
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    // 2) 视频画面（真实矩形边缘，alpha 混合覆盖背景）
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    gl.useProgram(this.video.program)
    this.bindQuad()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture.texture)
    gl.uniform1i(this.u(this.video, 'u_tex'), 0)
    gl.uniform2f(this.u(this.video, 'u_output'), output.width, output.height)
    gl.uniform2f(this.u(this.video, 'u_canvasSize'), this.canvasSize.width, this.canvasSize.height)
    gl.uniform1f(this.u(this.video, 'u_scale'), transform.scale)
    gl.uniform2f(this.u(this.video, 'u_offset'), transform.offsetX, transform.offsetY)
    // 运镜只在固定内容窗口内显示，避免放大/平移后的纹理覆盖某一侧背景边距。
    gl.uniform4f(
      this.u(this.video, 'u_clipRect'),
      placement.x,
      placement.y,
      placement.width,
      placement.height
    )
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    // 3) 点击波纹叠加（options.maxRipples 为配置上限，MAX_RIPPLES 为 shader 容量硬顶）
    const ripples = activeRipplesAt(
      clicks,
      tMs,
      ripple,
      transform,
      Math.min(this.options.maxRipples, MAX_RIPPLES)
    )
    if (ripples.length > 0) this.drawRipples(ripples)
    if (keyOverlay) this.keyOverlay.draw(keyOverlay, output, () => this.bindQuad())

    this.info = {
      outputWidth: output.width,
      outputHeight: output.height,
      sourceWidth: tex.sourceWidth,
      sourceHeight: tex.sourceHeight,
      textureWidth: tex.textureWidth,
      textureHeight: tex.textureHeight,
      downsample: tex.downsample,
      textureLimit: this.texture.limit,
      downsampled: tex.downsampled && this.reportTextureDownsample
    }
    return this.info
  }

  /** 最近一次渲染的信息（未渲染过为 null） */
  getInfo(): RenderInfo | null {
    return this.info
  }

  /**
   * 提交当前 GL 命令队列（kr-03 导出防御）：
   * Worker 里 drawFrame 后立即 new VideoFrame(canvas) 捕获画布时，
   * 先 flush 确保绘制命令已提交到 GPU 进程，快照不依赖隐式同步时机。
   */
  flush(): void {
    this.gl.flush()
  }

  private drawRipples(ripples: ReturnType<typeof activeRipplesAt>): void {
    const gl = this.gl
    const { ripple } = this.options
    const geom = new Float32Array(MAX_RIPPLES * 3)
    const alpha = new Float32Array(MAX_RIPPLES)
    ripples.forEach((r, i) => {
      geom[i * 3] = r.x
      geom[i * 3 + 1] = r.y
      geom[i * 3 + 2] = r.radius
      alpha[i] = r.alpha
    })
    gl.useProgram(this.ripple.program)
    this.bindQuad()
    gl.uniform2f(this.u(this.ripple, 'u_output'), this.options.output.width, this.options.output.height)
    gl.uniform1i(this.u(this.ripple, 'u_count'), ripples.length)
    gl.uniform3fv(this.u(this.ripple, 'u_rippleGeom'), geom)
    gl.uniform1fv(this.u(this.ripple, 'u_rippleAlpha'), alpha)
    const c: Rgba = ripple.color
    gl.uniform4f(this.u(this.ripple, 'u_color'), c[0], c[1], c[2], 1)
    gl.uniform1f(this.u(this.ripple, 'u_ringWidth'), ripple.ringWidth)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  private u(slots: ProgramSlots, name: string): WebGLUniformLocation {
    const loc = slots.uniforms.get(name)
    if (!loc) throw new CompositorError(`uniform 缺失: ${name}`)
    return loc
  }

  /** a_pos 固定 location 0（createProgram bindAttribLocation），三个程序共用同一缓冲 */
  private bindQuad(): void {
    const gl = this.gl
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  }

  dispose(): void {
    const gl = this.gl
    this.texture.dispose()
    this.keyOverlay.dispose()
    gl.deleteProgram(this.bg.program)
    gl.deleteProgram(this.video.program)
    gl.deleteProgram(this.ripple.program)
    gl.deleteBuffer(this.quad)
  }
}

/** 覆盖整屏的三角形（NDC），比 quad 少一次三角形接缝 */
function createQuadBuffer(gl: WebGL2RenderingContext): WebGLBuffer {
  const buf = gl.createBuffer()
  if (!buf) throw new CompositorError('创建顶点缓冲失败')
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  return buf
}

function makeSlots(
  gl: WebGL2RenderingContext,
  fragSrc: string,
  uniformNames: string[]
): ProgramSlots {
  const program = createProgram(gl, fragSrc)
  const uniforms = new Map<string, WebGLUniformLocation>()
  for (const name of uniformNames) {
    // 数组 uniform 用 "name[0]" 查询（getUniformLocation 对裸名兼容实现不一）
    const loc = gl.getUniformLocation(program, name) ?? gl.getUniformLocation(program, `${name}[0]`)
    if (loc) uniforms.set(name, loc)
  }
  return { program, uniforms }
}

function mergeOptions(config: CompositorConfig): CompositorOptions {
  const d = DEFAULT_COMPOSITOR_OPTIONS
  return {
    output: { ...d.output, ...config.output },
    background: { ...d.background, ...config.background },
    videoStyle: {
      ...d.videoStyle,
      ...config.videoStyle
    },
    ripple: { ...d.ripple, ...config.ripple },
    maxRipples: config.maxRipples ?? d.maxRipples
  }
}
