import {
  normalizeBackgroundPaddingPercent,
  type RenderSettings
} from '@shared/edit'
import type { OutputSize, Rgba } from './types'

export const BACKGROUND_OUTPUT: OutputSize = { width: 1920, height: 1080 }
export const DEFAULT_BACKGROUND_COLOR = '#16181D'

export interface OutputPlan {
  output: OutputSize
  backgroundEnabled: boolean
  backgroundColor: string
  paddingRatio: number
  downscaled: boolean
}

function even(value: number): number {
  const integer = Math.max(2, Math.floor(value))
  return integer % 2 === 0 ? integer : integer - 1
}

export function normalizeHexColor(value: string): string | null {
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : null
}

export function hexToRgba(value: string): Rgba {
  const color = normalizeHexColor(value) ?? DEFAULT_BACKGROUND_COLOR
  return [
    Number.parseInt(color.slice(1, 3), 16) / 255,
    Number.parseInt(color.slice(3, 5), 16) / 255,
    Number.parseInt(color.slice(5, 7), 16) / 255,
    1
  ]
}

export function fitOutputSize(source: OutputSize, max: OutputSize): OutputSize {
  const scale = Math.min(1, max.width / source.width, max.height / source.height)
  return { width: even(source.width * scale), height: even(source.height * scale) }
}

export function resolveOutputPlan(
  source: OutputSize,
  settings: RenderSettings,
  max?: OutputSize
): OutputPlan {
  const desired = settings.backgroundEnabled
    ? BACKGROUND_OUTPUT
    : { width: even(source.width), height: even(source.height) }
  const output = max ? fitOutputSize(desired, max) : desired
  return {
    output,
    backgroundEnabled: settings.backgroundEnabled,
    backgroundColor: normalizeHexColor(settings.backgroundColor) ?? DEFAULT_BACKGROUND_COLOR,
    paddingRatio: settings.backgroundEnabled
      ? normalizeBackgroundPaddingPercent(settings.backgroundPaddingPercent) / 100
      : 0,
    downscaled: output.width !== desired.width || output.height !== desired.height
  }
}
