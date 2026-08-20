/**
 * 合成器 GLSL 源码与编译辅助（Task 2.1–2.3）。
 * 统一 GLSL ES 1.00（WebGL2 上下文兼容），全屏三角形 + varying 输出像素坐标
 * （v_px 左上原点），三个 pass 共用同一顶点 shader 与属性缓冲。
 */

/** shader 内编译期波纹数组容量（uniform 数组必须常量尺寸） */
export const MAX_RIPPLES = 16

/** 全屏三角形：a_pos ∈ NDC，v_px 输出像素坐标，v_uv 归一化 0..1 */
export const VERT_SRC = /* glsl */ `
attribute vec2 a_pos;
uniform vec2 u_output;
varying vec2 v_px;
varying vec2 v_uv;
void main() {
  v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
  v_px = v_uv * u_output;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`

/** Task 2.2 背景层：沿 u_angle 方向的线性渐变，铺满整幅输出画布 */
export const BG_FRAG_SRC = /* glsl */ `
precision mediump float;
uniform vec4 u_colorFrom;
uniform vec4 u_colorTo;
uniform float u_angle;
varying vec2 v_uv;
void main() {
  vec2 dir = vec2(sin(u_angle), cos(u_angle));
  vec2 p = v_uv - 0.5;
  float g = clamp(dot(p, dir) + 0.5, 0.0, 1.0);
  gl_FragColor = mix(u_colorFrom, u_colorTo, g);
}
`

/**
 * Task 2.1 + 2.2 视频层：按相机仿射变换（u_scale/u_offset）反算纹理坐标采样，
 * 圆角 SDF 裁剪（1px 抗锯齿），矩形外按阴影 SDF 距离衰减画投影。
 * 画布外（含圆角外）的视频区域由阴影/背景透出，无黑边。
 */
export const VIDEO_FRAG_SRC = /* glsl */ `
precision highp float;
uniform sampler2D u_tex;
uniform vec2 u_canvasSize;
uniform float u_scale;
uniform vec2 u_offset;
uniform float u_cornerRadius;
uniform vec4 u_shadowColor;
uniform float u_shadowBlur;
uniform float u_shadowOffsetY;
varying vec2 v_px;
varying vec2 v_uv;

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec2 half_ = u_canvasSize * u_scale * 0.5;
  vec2 center = u_offset + half_;
  float r = min(u_cornerRadius, min(half_.x, half_.y));
  // 输出像素 → 画布坐标 → 纹理 uv（纹理首行 = 视频顶行，与左上原点一致）
  vec2 canvasPos = (v_px - u_offset) / u_scale;
  vec2 uv = clamp(canvasPos / u_canvasSize, 0.0, 1.0);
  float sd = sdRoundBox(v_px - center, half_, r);
  // 视频 alpha：圆角边界 1px 过渡
  float va = clamp(0.5 - sd, 0.0, 1.0);
  // 阴影：矩形（带垂直偏移）外向距离在 blur 内衰减
  float sdShadow = sdRoundBox(v_px - (center + vec2(0.0, u_shadowOffsetY)), half_, r);
  float sa = u_shadowColor.a * (1.0 - smoothstep(0.0, u_shadowBlur, sdShadow));
  vec4 shadow = vec4(u_shadowColor.rgb, sa);
  vec4 texel = texture2D(u_tex, uv);
  gl_FragColor = vec4(mix(shadow.rgb, texel.rgb, va), mix(shadow.a, 1.0, va));
}
`

/**
 * Task 2.3 波纹层：活动波纹（输出坐标 + 半径 + alpha）逐像素求环带强度，
 * 多波纹取 max 叠加。CPU 侧（layout.ts）按 clicks 时间窗计算后灌 uniform。
 */
export const RIPPLE_FRAG_SRC = /* glsl */ `
precision mediump float;
uniform int u_count;
uniform vec3 u_rippleGeom[${MAX_RIPPLES}]; // xy = 中心（输出像素），z = 半径
uniform float u_rippleAlpha[${MAX_RIPPLES}];
uniform vec4 u_color;
uniform float u_ringWidth;
varying vec2 v_px;
varying vec2 v_uv;
void main() {
  float a = 0.0;
  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    if (i >= u_count) break;
    vec3 g = u_rippleGeom[i];
    float ring = 1.0 - smoothstep(0.0, u_ringWidth, abs(distance(v_px, g.xy) - g.z));
    a = max(a, ring * u_rippleAlpha[i]);
  }
  gl_FragColor = vec4(u_color.rgb, a);
}
`

/** 编译 + 链接着色程序；a_pos 固定绑到 location 0（三个程序共用同一顶点缓冲） */
export function createProgram(
  gl: WebGL2RenderingContext,
  fragSrc: string
): WebGLProgram {
  const vs = compile(gl, gl.VERTEX_SHADER, VERT_SRC)
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragSrc)
  const program = gl.createProgram()
  if (!program) throw new Error('创建 shader program 失败')
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.bindAttribLocation(program, 0, 'a_pos')
  gl.linkProgram(program)
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    throw new Error(`shader 链接失败: ${log}`)
  }
  return program
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('创建 shader 失败')
  gl.shaderSource(shader, src)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`shader 编译失败: ${log}`)
  }
  return shader
}
