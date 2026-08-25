import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { CaptionLanguage } from '@shared/captions'
import { BUILTIN_CAPTION_MODEL_ID } from '@shared/captionModels'
import { usePreviewStore } from '@/store/previewStore'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Segmented } from '@/components/ui/segmented'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ParamRow } from './ParamRow'

const LANGUAGES: Array<{ value: CaptionLanguage; label: string }> = [
  { value: 'auto', label: '自动' }, { value: 'zh', label: '中文' }, { value: 'en', label: '英文' }
]

export function CaptionsPanel(): React.JSX.Element {
  const store = usePreviewStore()
  const [language, setLanguage] = useState<CaptionLanguage>('zh')
  const [modelId, setModelId] = useState<string>(BUILTIN_CAPTION_MODEL_ID)
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [confirmDeleteModel, setConfirmDeleteModel] = useState(false)
  const [pendingSrt, setPendingSrt] = useState<{ name: string; source: string } | null>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const active = useMemo(
    () => store.captions?.segments.find((segment) => segment.id === store.selectedCaptionId) ?? null,
    [store.captions, store.selectedCaptionId]
  )
  const busy = store.transcription.state === 'transcribing'
  const progress = store.transcription.state === 'transcribing'
    ? Math.round(store.transcription.progress * 100) : 0
  const recordedModel = store.captions?.transcriptionModel ?? null
  const selectedModel = store.captionModels.find((item) => item.id === modelId) ?? null
  const recordedMissing = Boolean(recordedModel && !store.captionModels.some((item) => item.id === recordedModel.id))
  const sessionId = store.current?.session.sessionId
  const recordedId = recordedModel?.id
  const lastSessionRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    const sessionChanged = lastSessionRef.current !== sessionId
    lastSessionRef.current = sessionId
    if (recordedId) setModelId(recordedId)
    else if (sessionChanged) setModelId(BUILTIN_CAPTION_MODEL_ID)
  }, [sessionId, recordedId])
  useEffect(() => {
    if (!active?.id.startsWith('caption-manual-')) return
    textRef.current?.focus()
    textRef.current?.select()
  }, [active?.id])

  const generate = (replaceExisting: boolean): void => {
    setConfirmReplace(false)
    void store.startTranscription(language, modelId, replaceExisting)
  }
  const importModel = (): void => {
    void store.importCaptionModel().then((imported) => { if (imported) setModelId(imported.id) })
  }
  const deleteModel = (): void => {
    const id = modelId
    setConfirmDeleteModel(false)
    void store.deleteCaptionModel(id).then(() => {
      setModelId(recordedId && recordedId !== id ? recordedId : BUILTIN_CAPTION_MODEL_ID)
    })
  }
  const generateDisabled = !selectedModel
  const pickSrt = (): void => {
    void window.api.importSessionSrt().then((result) => { if (result) setPendingSrt(result) })
  }
  const saveLabel = {
    idle: '', pending: '待保存', saving: '保存中…', saved: '已保存', error: '保存失败'
  }[store.captionsSaveState]

  return (
    <section className="flex w-full min-w-0 flex-col gap-3 border-b border-line px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-[11px] font-semibold tracking-[0.4px] text-ink-2">字幕</h3>
          <p className="mt-1 text-[10.5px] leading-4 text-ink-3">本地处理麦克风音轨</p>
        </div>
        <Switch checked={store.captionsEnabled}
          onChange={(enabled) => store.setCaptionsEnabled(enabled, language, modelId)} label="启用字幕" />
      </div>

      <AnimatePresence initial={false}>
        {store.captionsEnabled && <motion.div
          key="caption-controls" initial={{ height: 0, opacity: 0, y: -6 }}
          animate={{ height: 'auto', opacity: 1, y: 0 }} exit={{ height: 0, opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 overflow-hidden"
        >
        {store.current?.audioUrl ? <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
          <Segmented<CaptionLanguage> options={LANGUAGES} value={language} onChange={(value) => setLanguage(value)}
            className="w-full [&>button]:min-w-0 [&>button]:flex-1 [&>button]:px-2" />
          <div className="flex min-w-0 items-center gap-1.5">
            <Select value={modelId} onValueChange={setModelId} disabled={busy}>
              <SelectTrigger aria-label="字幕模型" className="min-w-0 flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {store.captionModels.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}{item.builtin ? '（内置）' : ''} · {Math.round(item.size / 1024 / 1024)}MB
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" disabled={busy} onClick={importModel}>导入模型</Button>
          </div>
          {recordedMissing && recordedModel && (
            <p className="text-[10.5px] leading-4 text-ink-3">
              模型已缺失：{recordedModel.name}。已有字幕仍可编辑与导出；重新生成请选择其他模型或重新导入。
            </p>
          )}
          {selectedModel && !selectedModel.builtin && !busy && (
            <button className="justify-self-end text-[10.5px] text-danger hover:underline"
              onClick={() => setConfirmDeleteModel(true)}>删除「{selectedModel.name}」</button>
          )}
          {busy ? (
            <div className="grid gap-1.5">
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full bg-accent" style={{ width: `${progress}%` }} />
              </div>
              <div className="flex items-center justify-between text-[10.5px] text-ink-3">
                <span>正在生成字幕 · {progress}%</span>
                <button className="text-accent hover:underline" onClick={() => void store.cancelTranscription()}>取消</button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" disabled={generateDisabled}
              onClick={() => store.captions ? setConfirmReplace(true) : generate(false)}>
              {store.captions ? '重新生成字幕' : '生成字幕'}
            </Button>
          )}
        </div> : <p className="rounded-lg bg-surface-2 px-3 py-2 text-[11px] leading-4 text-ink-3">
          此会话没有麦克风音轨，可导入 SRT 或手动添加字幕。
        </p>}

      {store.transcription.state === 'error' && (
        <p role="alert" className="text-[11px] leading-4 text-danger">{store.transcription.message}</p>
      )}
      {store.captionsError && <p role="alert" className="text-[11px] leading-4 text-danger">{store.captionsError}</p>}

      {store.captions && (
        <>
          <div className="flex items-center justify-between gap-2 text-[10.5px] text-ink-3">
            <button className={store.captionsSaveState === 'error' ? 'text-danger hover:underline' : ''}
              onClick={() => { if (store.captionsSaveState === 'error') store.retryCaptionSave() }}>
              {store.captions.segments.length} 条字幕{saveLabel ? ` · ${saveLabel}` : ''}
            </button>
            <span className="flex gap-3">
              <button className="text-accent hover:underline" onClick={pickSrt}>导入 SRT</button>
              <button className="text-accent hover:underline" onClick={() => void store.exportCaptionsSrt()}>导出 SRT</button>
            </span>
          </div>
          {active && (
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 rounded-lg border border-line bg-surface-2 p-2.5">
              <textarea ref={textRef} value={active.text} aria-label="字幕文字" rows={3}
                onChange={(event) => store.updateCaptionText(active.id, event.target.value)}
                className="resize-none rounded-md border border-line bg-surface-1 p-2 text-xs leading-5 text-ink-1 outline-none focus:border-accent" />
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => store.splitCaption(active.id, (active.startMs + active.endMs) / 2)}>分割</Button>
                <Button variant="ghost" size="sm" onClick={() => store.mergeCaptionWithNext(active.id)}>合并下一条</Button>
                <Button variant="ghost" size="sm" onClick={() => store.removeCaption(active.id)}>删除</Button>
              </div>
            </div>
          )}

          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 rounded-lg border border-line bg-surface-2 p-2.5">
            <Select value={store.captions.style.fontPreset}
              onValueChange={(value) => store.setCaptionStyle({ fontPreset: value as 'sans' | 'rounded' | 'serif' })}>
              <SelectTrigger aria-label="字幕字体"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sans">现代无衬线</SelectItem>
                <SelectItem value="rounded">圆体</SelectItem>
                <SelectItem value="serif">衬线体</SelectItem>
              </SelectContent>
            </Select>
            <ParamRow label="字号" value={store.captions.style.fontSize} min={12} max={96} step={1}
              format={(value) => `${value}px`} onChange={(fontSize) => store.setCaptionStyle({ fontSize })} />
            <ParamRow label="描边" value={store.captions.style.strokeWidth} min={0} max={8} step={1}
              format={(value) => `${value}px`} onChange={(strokeWidth) => store.setCaptionStyle({ strokeWidth })} />
            <ParamRow label="圆角" value={store.captions.style.cornerRadius} min={0} max={32} step={1}
              format={(value) => `${value}px`} onChange={(cornerRadius) => store.setCaptionStyle({ cornerRadius })} />
            <ParamRow label="最大宽度" value={Math.round(store.captions.style.maxWidthRatio * 100)} min={30} max={90} step={1}
              format={(value) => `${value}%`} onChange={(value) => store.setCaptionStyle({ maxWidthRatio: value / 100 })} />
            <ParamRow label="背景透明" value={Math.round(store.captions.style.backgroundOpacity * 100)} min={0} max={100} step={5}
              format={(value) => `${value}%`} onChange={(value) => store.setCaptionStyle({ backgroundOpacity: value / 100 })} />
            <ParamRow label="淡入淡出" value={store.captions.style.fadeMs} min={0} max={500} step={20}
              format={(value) => `${value}ms`} onChange={(fadeMs) => store.setCaptionStyle({ fadeMs })} />
            <div className="grid min-w-0 grid-cols-3 gap-1.5 text-[10.5px] text-ink-2">
              <ColorField label="文字" ariaLabel="字幕文字颜色" value={store.captions.style.textColor}
                onChange={(textColor) => store.setCaptionStyle({ textColor })} />
              <ColorField label="描边" ariaLabel="字幕描边颜色" value={store.captions.style.strokeColor}
                onChange={(strokeColor) => store.setCaptionStyle({ strokeColor })} />
              <ColorField label="背景" ariaLabel="字幕背景颜色" value={store.captions.style.backgroundColor}
                onChange={(backgroundColor) => store.setCaptionStyle({ backgroundColor })} />
            </div>
            <Segmented options={[{ value: 'left', label: '左对齐' }, { value: 'center', label: '居中' }, { value: 'right', label: '右对齐' }]}
              value={store.captions.style.align} onChange={(align) => store.setCaptionStyle({ align: align as 'left' | 'center' | 'right' })}
              className="w-full [&>button]:min-w-0 [&>button]:flex-1 [&>button]:px-2" />
            <Segmented options={[{ value: 'global', label: '全局位置' }, { value: 'segment', label: '单段位置' }]}
              value={store.captionPositionMode} onChange={store.setCaptionPositionMode}
              className="w-full [&>button]:min-w-0 [&>button]:flex-1 [&>button]:px-2" />
          </div>
        </>
      )}
        </motion.div>}
      </AnimatePresence>

      <ConfirmDialog open={confirmReplace} title="重新生成字幕？"
        description="新结果成功保存后会替换现有字幕文字和时间；取消或失败不会修改当前字幕。"
        confirmLabel="重新生成" destructive onCancel={() => setConfirmReplace(false)} onConfirm={() => generate(true)} />
      <ConfirmDialog open={confirmDeleteModel} title="删除模型？"
        description={`删除「${selectedModel?.name ?? ''}」后会移除本地模型文件；使用它生成的已有字幕不受影响。内置模型不可删除。`}
        confirmLabel="删除" destructive onCancel={() => setConfirmDeleteModel(false)} onConfirm={deleteModel} />
      <ConfirmDialog open={pendingSrt !== null} title="导入并替换字幕？"
        description={`导入 ${pendingSrt?.name ?? 'SRT'} 后会替换当前字幕文字和时间，时间戳按原始录像时间轴解释。`}
        confirmLabel="导入替换" destructive onCancel={() => setPendingSrt(null)}
        onConfirm={() => { if (pendingSrt) store.importCaptionsSrt(pendingSrt.source); setPendingSrt(null) }} />
    </section>
  )
}

function ColorField({ label, ariaLabel, value, onChange }: {
  label: string
  ariaLabel: string
  value: string
  onChange(value: string): void
}): React.JSX.Element {
  return (
    <label className="flex min-w-0 items-center justify-between gap-1 rounded-md border border-line bg-surface-1 px-2 py-1.5">
      <span className="truncate">{label}</span>
      <span className="relative h-5 w-5 flex-none overflow-hidden rounded border border-line-strong shadow-sm"
        style={{ backgroundColor: value }}>
        <input type="color" aria-label={ariaLabel} value={value}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          onChange={(event) => onChange(event.target.value.toUpperCase())} />
      </span>
    </label>
  )
}
