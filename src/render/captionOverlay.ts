import type { CaptionStyle, CaptionsDocument } from '@shared/captions'
import { activeCaption } from '@/captions/operations'
import type { KeyOverlayFrame, OutputSize } from './types'

const cache = new Map<string, OffscreenCanvas>()

export function captionOverlayFrameAt(
  document: CaptionsDocument | null,
  tMs: number,
  output: OutputSize
): KeyOverlayFrame | null {
  const segment = activeCaption(document, tMs)
  if (!document || !segment) return null
  const source = captionTexture(segment.text, document.style, output)
  const position = segment.positionOverride ?? document.style.position
  const safe = Math.max(16, Math.round(Math.min(output.width, output.height) * 0.03))
  const x = clamp(position.x * output.width - source.width / 2, safe, output.width - safe - source.width)
  const y = clamp(position.y * output.height - source.height / 2, safe, output.height - safe - source.height)
  const fade = Math.min(document.style.fadeMs, (segment.endMs - segment.startMs) / 2)
  const alpha = fade <= 0 ? 1 : Math.min(1, (tMs - segment.startMs) / fade, (segment.endMs - tMs) / fade)
  return { source, x, y, width: source.width, height: source.height, alpha: Math.max(0, alpha) }
}

function captionTexture(text: string, style: CaptionStyle, output: OutputSize): OffscreenCanvas {
  const key = JSON.stringify([text, style, output.width, output.height])
  const existing = cache.get(key)
  if (existing) return existing
  if (cache.size > 128) cache.clear()
  const scale = Math.max(0.5, Math.min(output.width / 1920, output.height / 1080))
  const fontSize = Math.max(12, Math.round(style.fontSize * scale))
  const maxWidth = Math.max(120, Math.round(output.width * style.maxWidthRatio))
  const paddingX = Math.round(fontSize * 0.55)
  const paddingY = Math.round(fontSize * 0.34)
  const font = `${fontSize}px ${fontFamily(style.fontPreset)}`
  const measure = new OffscreenCanvas(1, 1).getContext('2d')
  if (!measure) throw new Error('字幕画布初始化失败')
  measure.font = font
  const lines = wrapText(measure, text, maxWidth - paddingX * 2)
  const lineHeight = Math.round(fontSize * 1.3)
  const textWidth = Math.min(maxWidth - paddingX * 2, Math.max(...lines.map((line) => measure.measureText(line).width)))
  const width = Math.ceil(textWidth + paddingX * 2 + style.strokeWidth * 2)
  const height = Math.ceil(lines.length * lineHeight + paddingY * 2 + style.strokeWidth * 2)
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('字幕画布初始化失败')
  ctx.beginPath()
  ctx.roundRect(0, 0, width, height, Math.round(style.cornerRadius * scale))
  ctx.fillStyle = hexAlpha(style.backgroundColor, style.backgroundOpacity)
  ctx.fill()
  ctx.font = font
  ctx.textBaseline = 'middle'
  ctx.textAlign = style.align
  ctx.lineJoin = 'round'
  const anchorX = style.align === 'left' ? paddingX : style.align === 'right' ? width - paddingX : width / 2
  lines.forEach((line, index) => {
    const y = paddingY + lineHeight * (index + 0.5)
    if (style.strokeWidth > 0) {
      ctx.strokeStyle = style.strokeColor
      ctx.lineWidth = style.strokeWidth * 2 * scale
      ctx.strokeText(line, anchorX, y)
    }
    ctx.fillStyle = style.textColor
    ctx.fillText(line, anchorX, y)
  })
  cache.set(key, canvas)
  return canvas
}

function wrapText(ctx: OffscreenCanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const paragraphs = text.replace(/\r/g, '').split('\n')
  const lines: string[] = []
  for (const paragraph of paragraphs) {
    let line = ''
    const tokens = /\s/.test(paragraph) ? paragraph.split(/(\s+)/) : [...paragraph]
    for (const token of tokens) {
      const next = line + token
      if (line && ctx.measureText(next).width > maxWidth) { lines.push(line.trim()); line = token.trimStart() }
      else line = next
    }
    if (line.trim() || lines.length === 0) lines.push(line.trim())
  }
  return lines.slice(0, 4)
}

function fontFamily(preset: CaptionStyle['fontPreset']): string {
  if (preset === 'rounded') return 'ui-rounded, "SF Pro Rounded", "Segoe UI", sans-serif'
  if (preset === 'serif') return 'ui-serif, "Songti SC", Georgia, serif'
  return 'system-ui, -apple-system, "Segoe UI", "PingFang SC", sans-serif'
}

function hexAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)) }
