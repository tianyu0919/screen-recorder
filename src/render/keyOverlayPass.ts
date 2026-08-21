import { createProgram } from './shaders'
import { VideoTexture } from './texture'
import type { FrameSource, KeyOverlayFrame, OutputSize } from './types'

const FRAGMENT = /* glsl */ `
precision mediump float;
uniform sampler2D u_tex;
uniform vec4 u_rect;
uniform float u_alpha;
varying vec2 v_px;
void main() {
  vec2 local = (v_px - u_rect.xy) / u_rect.zw;
  if (local.x < 0.0 || local.y < 0.0 || local.x > 1.0 || local.y > 1.0) discard;
  vec4 color = texture2D(u_tex, local);
  gl_FragColor = vec4(color.rgb, color.a * u_alpha);
}
`

/** 独立 pass，提示内容没变化时不重复上传纹理。 */
export class KeyOverlayPass {
  private readonly program: WebGLProgram
  private readonly texture: VideoTexture
  private source: FrameSource | null = null
  private readonly uniforms: Record<'tex' | 'rect' | 'alpha' | 'output', WebGLUniformLocation>

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.program = createProgram(gl, FRAGMENT)
    this.texture = new VideoTexture(gl)
    this.uniforms = {
      tex: required(gl, this.program, 'u_tex'),
      rect: required(gl, this.program, 'u_rect'),
      alpha: required(gl, this.program, 'u_alpha'),
      output: required(gl, this.program, 'u_output')
    }
  }

  draw(frame: KeyOverlayFrame, output: OutputSize, bindQuad: () => void): void {
    const gl = this.gl
    if (frame.source !== this.source) {
      this.texture.upload(frame.source)
      this.source = frame.source
    }
    gl.useProgram(this.program)
    bindQuad()
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.texture.texture)
    gl.uniform1i(this.uniforms.tex, 1)
    gl.uniform2f(this.uniforms.output, output.width, output.height)
    gl.uniform4f(this.uniforms.rect, frame.x, frame.y, frame.width, frame.height)
    gl.uniform1f(this.uniforms.alpha, frame.alpha)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  dispose(): void {
    this.texture.dispose()
    this.gl.deleteProgram(this.program)
  }
}

function required(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string
): WebGLUniformLocation {
  const value = gl.getUniformLocation(program, name)
  if (!value) throw new Error(`uniform 缺失: ${name}`)
  return value
}
