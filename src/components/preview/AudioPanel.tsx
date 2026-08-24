import { usePreviewStore } from '@/store/previewStore'
import { CloseIcon } from '@/components/icons'
import { ParamRow } from './ParamRow'
import { Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/utils'

function MuteButton(props: {
  muted: boolean
  disabled?: boolean
  label: string
  onChange(): void
}): React.JSX.Element {
  const Icon = props.muted ? VolumeX : Volume2
  return (
    <button
      type="button"
      aria-label={`${props.muted ? '取消静音' : '静音'}${props.label}`}
      aria-pressed={props.muted}
      disabled={props.disabled}
      onClick={props.onChange}
      className={cn(
        'grid h-7 w-7 flex-none place-items-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40',
        props.muted
          ? 'border-accent-border bg-accent-soft text-accent'
          : 'border-line bg-surface-2 text-ink-2 hover:border-line-strong hover:text-ink-1'
      )}
    >
      <Icon size={13} />
    </button>
  )
}

/**
 * 检查器·音频：录制轨（mic/system）分轨增益 + 自定义音轨管理（kr-05）。
 * 录制轨滑杆在无对应音轨时禁用；自定义轨（BGM/旁白）添加后在时间轴「音频」行
 * 以波形块呈现，可拖拽定位，此处调音量/删除。
 */
export function AudioPanel(): React.JSX.Element | null {
  const {
    current,
    audioGain,
    audioMute,
    setAudioGain,
    setAudioMuted,
    customClips,
    clipError,
    removeCustomClip,
    setClipGain,
    setClipMuted
  } = usePreviewStore()
  if (!current) return null
  const hasSessionAudio = current.audioUrl !== null || current.systemAudioUrl !== null

  return (
    <section className="flex flex-col gap-3 border-b border-line px-4 py-3.5">
      <h3 className="text-[11px] font-semibold tracking-[0.4px] text-ink-3">音频</h3>

      {hasSessionAudio && (
        <>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <ParamRow label="麦克风" value={Math.round(audioGain.mic * 100)} min={0}
                max={100} step={5} format={(v) => `${v}%`}
                onChange={(v) => setAudioGain({ mic: v / 100 })}
                disabled={!current.audioUrl || audioMute.mic} />
            </div>
            <MuteButton muted={audioMute.mic} disabled={!current.audioUrl} label="麦克风"
              onChange={() => setAudioMuted('mic', !audioMute.mic)} />
          </div>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <ParamRow label="系统音频" value={Math.round(audioGain.system * 100)} min={0}
                max={100} step={5} format={(v) => `${v}%`}
                onChange={(v) => setAudioGain({ system: v / 100 })}
                disabled={!current.systemAudioUrl || audioMute.system} />
            </div>
            <MuteButton muted={audioMute.system} disabled={!current.systemAudioUrl}
              label="系统音频" onChange={() => setAudioMuted('system', !audioMute.system)} />
          </div>
        </>
      )}

      {clipError && <p className="text-[11.5px] text-red-300">{clipError}</p>}

      {customClips.map((clip) => (
        <div key={clip.id} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-[11.5px] text-ink-2" title={clip.name}>
              {clip.name}
            </span>
            <button
              onClick={() => removeCustomClip(clip.id)}
              aria-label={`删除音轨 ${clip.name}`}
              className="flex-none text-ink-3 hover:text-ink-1"
            >
              <CloseIcon size={12} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <ParamRow label="音量" value={Math.round(clip.gain * 100)} min={0} max={100}
                step={5} format={(v) => `${v}%`}
                onChange={(v) => setClipGain(clip.id, v / 100)} disabled={clip.muted} />
            </div>
            <MuteButton muted={clip.muted} label={clip.name}
              onChange={() => setClipMuted(clip.id, !clip.muted)} />
          </div>
        </div>
      ))}
    </section>
  )
}
