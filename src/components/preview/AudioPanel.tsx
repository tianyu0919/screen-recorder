import { usePreviewStore } from '@/store/previewStore'
import { CloseIcon } from '@/components/icons'
import { ParamRow } from './ParamRow'

/**
 * 检查器·音频：录制轨（mic/system）分轨增益 + 自定义音轨管理（kr-05）。
 * 录制轨滑杆在无对应音轨时禁用；自定义轨（BGM/旁白）添加后在时间轴「音频」行
 * 以波形块呈现，可拖拽定位，此处调音量/删除。
 */
export function AudioPanel(): React.JSX.Element | null {
  const {
    current,
    audioGain,
    setAudioGain,
    customClips,
    clipError,
    removeCustomClip,
    setClipGain
  } = usePreviewStore()
  if (!current) return null
  const hasSessionAudio = current.audioUrl !== null || current.systemAudioUrl !== null

  return (
    <section className="flex flex-col gap-3 border-b border-line px-4 py-3.5">
      <h3 className="text-[11px] font-semibold tracking-[0.4px] text-ink-3">音频</h3>

      {hasSessionAudio && (
        <>
          <ParamRow
            label="麦克风"
            value={Math.round(audioGain.mic * 100)}
            min={0}
            max={100}
            step={5}
            format={(v) => `${v}%`}
            onChange={(v) => setAudioGain({ mic: v / 100 })}
            disabled={!current.audioUrl}
          />
          <ParamRow
            label="系统音频"
            value={Math.round(audioGain.system * 100)}
            min={0}
            max={100}
            step={5}
            format={(v) => `${v}%`}
            onChange={(v) => setAudioGain({ system: v / 100 })}
            disabled={!current.systemAudioUrl}
          />
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
          <ParamRow
            label="音量"
            value={Math.round(clip.gain * 100)}
            min={0}
            max={100}
            step={5}
            format={(v) => `${v}%`}
            onChange={(v) => setClipGain(clip.id, v / 100)}
          />
        </div>
      ))}
    </section>
  )
}
