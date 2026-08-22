import type { DisplayKeyPrompt } from '@/timeline/keyPrompts'
import { activeKeyPromptAt } from '@/timeline/keyPrompts'
import type { KeyOverlayFrame, OutputSize } from './types'

const cache = new Map<string, OffscreenCanvas>()
const GAP = 7
const SEPARATOR_WIDTH = 12
const PAD_X = 10
const HEIGHT = 48

export function keyOverlayFrameAt(
  prompts: DisplayKeyPrompt[],
  tMs: number,
  position: { x: number; y: number },
  output: OutputSize
): KeyOverlayFrame | null {
  const active = activeKeyPromptAt(prompts, tMs)
  if (!active || active.alpha <= 0) return null
  const source = promptTexture(active.prompt.keys)
  const scale = Math.min(1, output.width / 960)
  const width = source.width * scale
  const height = source.height * scale
  const margin = Math.max(16, 28 * scale)
  const centerX = clamp(position.x * output.width, margin + width / 2, output.width - margin - width / 2)
  const centerY = clamp(position.y * output.height, margin + height / 2, output.height - margin - height / 2)
  return {
    source,
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
    alpha: active.alpha
  }
}

function promptTexture(keys: string[]): OffscreenCanvas {
  const cacheKey = keys.join('\u0000')
  const existing = cache.get(cacheKey)
  if (existing) return existing
  const measure = new OffscreenCanvas(1, 1).getContext('2d')
  if (!measure) throw new Error('按键提示画布初始化失败')
  measure.font = '600 18px system-ui, sans-serif'
  const widths = keys.map((key) => Math.max(40, Math.ceil(measure.measureText(key).width) + 22))
  const separators = Math.max(0, keys.length - 1)
  const width = PAD_X * 2 + widths.reduce((sum, value) => sum + value, 0) + (GAP * 2 + SEPARATOR_WIDTH) * separators
  const canvas = new OffscreenCanvas(width, HEIGHT + 14)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('按键提示画布初始化失败')
  ctx.font = '600 18px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0,0,0,.3)'
  ctx.shadowBlur = 12
  ctx.shadowOffsetY = 4
  roundedRect(ctx, 0, 0, width, HEIGHT, 14)
  ctx.fillStyle = 'rgba(24,26,30,.78)'
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
  ctx.strokeStyle = 'rgba(255,255,255,.13)'
  ctx.lineWidth = 1
  ctx.stroke()
  let x = PAD_X
  keys.forEach((key, index) => {
    const keyWidth = widths[index]
    roundedRect(ctx, x, 7, keyWidth, HEIGHT - 14, 9)
    ctx.fillStyle = 'rgba(255,255,255,.11)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,.2)'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,.96)'
    ctx.fillText(key, x + keyWidth / 2, HEIGHT / 2)
    x += keyWidth
    if (index < keys.length - 1) {
      x += GAP
      ctx.fillStyle = 'rgba(255,255,255,.45)'
      ctx.font = '500 15px system-ui, sans-serif'
      ctx.fillText('+', x + SEPARATOR_WIDTH / 2, HEIGHT / 2)
      ctx.font = '600 18px system-ui, sans-serif'
      x += SEPARATOR_WIDTH + GAP
    }
  })
  cache.set(cacheKey, canvas)
  return canvas
}

function roundedRect(
  ctx: OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath()
  ctx.roundRect(x, y, width, height, radius)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
