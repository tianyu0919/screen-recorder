import { Fragment, useEffect, useState } from 'react'
import { Play } from 'lucide-react'
import type { TtsVoiceListItem } from '@shared/tts'
import { usePreviewStore } from '@/store/previewStore'
import { buildTtsSegmentRequests, ttsDerivedKey } from '@/tts/segments'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { cn } from '@/lib/utils'

function VoiceRow(props: {
  voice: TtsVoiceListItem
  selected: boolean
  previewing: boolean
  onSelect(): void
  onPreview(): void
}): React.JSX.Element {
  const { voice } = props
  return (
    <div
      role="button" tabIndex={0} aria-label={`音色 ${voice.name}`} aria-pressed={props.selected}
      onClick={props.onSelect}
      onKeyDown={(event) => { if (event.key === 'Enter') props.onSelect() }}
      className={cn(
        'flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 outline-none transition-colors',
        props.selected
          ? 'border-accent bg-accent-soft'
          : 'border-line bg-surface-2 hover:border-line-strong'
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[11.5px] text-ink-1">{voice.name}</span>
          {voice.languages.map((lang) => (
            <span key={lang}
              className="flex-none rounded border border-line bg-surface-1 px-1 text-[9px] leading-3.5 text-ink-3">
              {lang === 'zh' ? '中' : '英'}
            </span>
          ))}
        </div>
        <p className="mt-0.5 text-[10px] text-ink-3">
          {voice.available ? (voice.bundled ? '内置 · 离线可用' : '自定义模型') : '内置模型缺失 · 请重新安装'}
        </p>
      </div>
      {voice.available && (
        <button type="button" aria-label={`试听 ${voice.name}`} disabled={props.previewing}
          onClick={(event) => { event.stopPropagation(); props.onPreview() }}
          className="grid h-6 w-6 flex-none place-items-center rounded-md border border-line bg-surface-1 text-ink-2 hover:border-line-strong hover:text-ink-1 disabled:opacity-40">
          <Play size={11} />
        </button>
      )}
    </div>
  )
}

/**
 * 检查器·配音（kr-08-tts-dubbing）：音色选择/试听/模型下载导入，按字幕生成 TTS 派生轨。
 * 开启后 mic 轨位切换到派生轨（预览与导出一致）；无 mic.wav 会话按「字幕配音」语义生成。
 */
export function TtsPanel(): React.JSX.Element | null {
  const {
    current, ttsSettings, ttsVoices, ttsJob, captions,
    startTtsGeneration, cancelTtsGeneration, setTtsEnabled,
    previewTtsVoice, importTtsModel, deleteTtsModel
  } = usePreviewStore()
  const sessionId = current?.session.sessionId
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(ttsSettings?.voiceId ?? null)
  const [previewingId, setPreviewingId] = useState<string | null>(null)
  const [confirmDeleteModel, setConfirmDeleteModel] = useState(false)
  const [stale, setStale] = useState(false)
  // 会话切换 / 外部生成完成时跟随持久化的 voiceId
  useEffect(() => {
    setSelectedVoiceId(ttsSettings?.voiceId ?? null)
  }, [sessionId, ttsSettings?.voiceId])

  // 字幕变更失效检测（Task 4.4）：重算当前字幕 + 音色的整轨指纹，
  // 与生成时持久化的 derivedKey 不一致 → 提示重新生成（sha1 开销可忽略，仅离散编辑触发）
  const derivedKeySaved = ttsSettings?.derivedKey
  useEffect(() => {
    let cancelled = false
    if (!ttsSettings?.enabled || !derivedKeySaved || !captions || captions.segments.length === 0) {
      setStale(false)
      return
    }
    void (async () => {
      const requests = await buildTtsSegmentRequests(captions, ttsSettings.voiceId)
      const key = await ttsDerivedKey(requests, ttsSettings.voiceId)
      if (!cancelled) setStale(key !== derivedKeySaved)
    })()
    return () => { cancelled = true }
  }, [captions, ttsSettings?.enabled, ttsSettings?.voiceId, derivedKeySaved])

  if (!current) return null
  const hasMic = current.audioUrl !== null
  const running = ttsJob?.state === 'running'
  const progress = running && ttsJob.progress.total > 0
    ? Math.round((ttsJob.progress.done / ttsJob.progress.total) * 100)
    : 0
  const selectedVoice = ttsVoices.find((voice) => voice.id === selectedVoiceId) ?? null
  const effectiveVoiceId = selectedVoiceId ?? ttsVoices.find((voice) => voice.available)?.id ?? null
  const generateDisabled =
    running || !effectiveVoiceId || !ttsVoices.some((voice) => voice.id === effectiveVoiceId && voice.available)
  const derivedMissing = Boolean(ttsSettings?.enabled && !current.ttsDerivedUrl)
  const selectedModelKey = selectedVoice?.modelKey.startsWith('custom-')
    ? selectedVoice.modelKey
    : null
  const voiceGroups = [
    { label: '中英双语', voices: ttsVoices.filter((voice) => voice.bundled && voice.languages.length === 2) },
    { label: '中文专用', voices: ttsVoices.filter((voice) => voice.bundled && voice.languages.length === 1 && voice.languages[0] === 'zh') },
    { label: '英文专用', voices: ttsVoices.filter((voice) => voice.bundled && voice.languages.length === 1 && voice.languages[0] === 'en') },
    { label: '自定义', voices: ttsVoices.filter((voice) => !voice.bundled) }
  ].filter((group) => group.voices.length > 0)

  const preview = (voice: TtsVoiceListItem): void => {
    setPreviewingId(voice.id)
    void previewTtsVoice(voice.id, voice.languages[0] ?? 'zh').finally(() => setPreviewingId(null))
  }
  return (
    <section className="flex flex-col gap-3 border-b border-line px-4 py-3.5">
      <div>
        <h3 className="text-[11px] font-semibold tracking-[0.4px] text-ink-2">配音</h3>
        <p className="mt-1 text-[10.5px] leading-4 text-ink-3">
          {hasMic ? '按字幕生成语音，替换麦克风轨' : '字幕配音：此会话无麦克风轨，将生成配音轨'}
        </p>
      </div>

      {derivedMissing && (
        <p role="alert" className="rounded-lg bg-amber-950/60 px-3 py-2 text-[11px] leading-4 text-amber-300">
          派生文件丢失，请重新生成
        </p>
      )}

      {stale && !derivedMissing && (
        <p role="alert" className="rounded-lg bg-amber-950/60 px-3 py-2 text-[11px] leading-4 text-amber-300">
          字幕已修改，配音与最新内容不一致，建议重新生成
        </p>
      )}

      {ttsVoices.length > 0 ? (
        <div className="grid max-h-44 min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5 overflow-y-auto">
          {voiceGroups.map((group) => (
            <Fragment key={group.label}>
              <p className="px-0.5 pt-1 text-[9.5px] font-medium tracking-wide text-ink-3">{group.label}</p>
              {group.voices.map((voice) => (
                <VoiceRow key={voice.id} voice={voice}
                  selected={voice.id === effectiveVoiceId}
                  previewing={previewingId === voice.id}
                  onSelect={() => setSelectedVoiceId(voice.id)}
                  onPreview={() => preview(voice)} />
              ))}
            </Fragment>
          ))}
        </div>
      ) : (
        <p className="text-[11px] leading-4 text-ink-3">音色列表加载中…</p>
      )}

      <div className="flex items-center justify-between gap-2">
        <button className="text-[10.5px] text-accent hover:underline"
          onClick={() => void importTtsModel()}>导入模型</button>
        {selectedModelKey && (
          <button className="text-[10.5px] text-danger hover:underline"
            onClick={() => setConfirmDeleteModel(true)}>删除「{selectedVoice?.name}」</button>
        )}
      </div>

      {running ? (
        <div className="grid gap-1.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full bg-accent transition-[width]" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex items-center justify-between text-[10.5px] text-ink-3">
            <span>正在生成配音 · {ttsJob.progress.done}/{ttsJob.progress.total}</span>
            <button className="text-accent hover:underline" onClick={() => void cancelTtsGeneration()}>取消</button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" disabled={generateDisabled}
          onClick={() => { if (effectiveVoiceId) void startTtsGeneration(effectiveVoiceId) }}>
          {ttsSettings?.derivedFile ? '重新生成配音' : '生成配音'}
        </Button>
      )}
      {!captions?.segments.length && !running && (
        <p className="text-[10.5px] leading-4 text-ink-3">需要先有字幕：在「字幕」区生成或导入。</p>
      )}
      {ttsJob?.state === 'failed' && (
        <p role="alert" className="text-[11px] leading-4 text-danger">{ttsJob.error ?? '配音生成失败'}</p>
      )}

      {ttsSettings?.enabled && !derivedMissing && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10.5px] text-ink-3">已启用配音轨（{ttsSettings.voiceId}）</span>
          <button className="text-[10.5px] text-accent hover:underline"
            onClick={() => setTtsEnabled(false)}>{hasMic ? '切回原声' : '关闭配音'}</button>
        </div>
      )}

      <ConfirmDialog open={confirmDeleteModel} title="删除模型？"
        description={`删除「${selectedVoice?.name ?? ''}」后会移除本地模型文件；已生成的配音轨不受影响。`}
        confirmLabel="删除" destructive onCancel={() => setConfirmDeleteModel(false)}
        onConfirm={() => { setConfirmDeleteModel(false); if (selectedModelKey) void deleteTtsModel(selectedModelKey) }} />
    </section>
  )
}
