import { useEffect, useState } from 'react'
import { usePreviewStore } from '@/store/previewStore'
import { Switch } from '@/components/ui/switch'
import { normalizeHexColor } from '@/render/outputPlan'
import { cn } from '@/lib/utils'
import { ParamRow } from './ParamRow'
import {
  MAX_BACKGROUND_PADDING_PERCENT,
  MIN_BACKGROUND_PADDING_PERCENT
} from '@shared/edit'

const PRESETS = ['#16181D', '#F4F2EE', '#FFFFFF', '#262A33', '#2D3A4A', '#5C382C']

export function BackgroundPanel(): React.JSX.Element {
  const settings = usePreviewStore((state) => state.renderSettings)
  const setSettings = usePreviewStore((state) => state.setRenderSettings)
  const [draft, setDraft] = useState(settings.backgroundColor)
  const [invalid, setInvalid] = useState(false)
  useEffect(() => setDraft(settings.backgroundColor), [settings.backgroundColor])

  const commit = (value: string): void => {
    const color = normalizeHexColor(value)
    setInvalid(color === null)
    if (color) setSettings({ backgroundColor: color })
  }

  return (
    <section className="flex flex-col gap-3 border-b border-line px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-[11px] font-semibold tracking-[0.4px] text-ink-2">背景图层</h3>
          <p className="mt-1 text-[10.5px] leading-4 text-ink-3">
            关闭时按录制内容原比例输出
          </p>
        </div>
        <Switch checked={settings.backgroundEnabled}
          onChange={(backgroundEnabled) => setSettings({ backgroundEnabled })}
          label="启用背景图层" />
      </div>
      {settings.backgroundEnabled && (
        <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface-2 p-3">
          <ParamRow
            label="画面边距"
            value={settings.backgroundPaddingPercent}
            min={MIN_BACKGROUND_PADDING_PERCENT}
            max={MAX_BACKGROUND_PADDING_PERCENT}
            step={1}
            format={(value) => `${value}%`}
            onChange={(backgroundPaddingPercent) => setSettings({ backgroundPaddingPercent })}
          />
          <p className="-mt-1 text-[10px] leading-4 text-ink-3">相对输出画布短边计算</p>
          <div className="flex flex-wrap gap-2" aria-label="背景颜色预设">
            {PRESETS.map((color) => (
              <button key={color} type="button" aria-label={`背景颜色 ${color}`}
                aria-pressed={settings.backgroundColor === color} onClick={() => commit(color)}
                className={cn(
                  'h-7 w-7 rounded-md border border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  settings.backgroundColor === color &&
                    'ring-2 ring-accent ring-offset-2 ring-offset-surface-2'
                )}
                style={{ backgroundColor: color }} />
            ))}
          </div>
          <div className="grid grid-cols-[36px_1fr] items-end gap-2">
            <label className="grid gap-1 text-[10.5px] text-ink-3">颜色
              <input type="color" value={settings.backgroundColor}
                onChange={(event) => commit(event.target.value)}
                className="h-8 w-9 cursor-pointer rounded-md border border-line bg-transparent p-0.5" />
            </label>
            <label className="grid gap-1 text-[10.5px] text-ink-3">HEX
              <input value={draft} onChange={(event) => {
                setDraft(event.target.value)
                setInvalid(false)
              }} onBlur={() => commit(draft)}
              onKeyDown={(event) => { if (event.key === 'Enter') commit(draft) }}
              aria-invalid={invalid}
              className="h-8 rounded-md border border-line bg-surface-1 px-2 font-mono text-xs uppercase text-ink-1 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
            </label>
          </div>
          {invalid && <p role="alert" className="text-[10.5px] text-danger">请输入六位 HEX，例如 #16181D</p>}
        </div>
      )}
    </section>
  )
}
