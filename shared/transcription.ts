import type { CaptionSegment } from './captions'

export function parseWhisperProgress(chunk: string): number | null {
  const matches = [...chunk.matchAll(/progress\s*=\s*(\d+)%/gi)]
  const latest = matches[matches.length - 1]
  return latest ? Math.min(1, Math.max(0, Number(latest[1]) / 100)) : null
}

export function parseWhisperSrt(source: string): CaptionSegment[] {
  return source.replace(/\r/g, '').trim().split(/\n{2,}/).flatMap((block, index) => {
    const lines = block.split('\n')
    const timeIndex = lines.findIndex((line) => line.includes('-->'))
    if (timeIndex < 0) return []
    const [startMs, endMs] = lines[timeIndex].split('-->').map(parseTimestamp)
    const text = lines.slice(timeIndex + 1).join('\n').trim()
    return Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs && text
      ? [{ id: `caption-${index + 1}-${startMs}`, startMs, endMs, text }]
      : []
  })
}

export function groupCaptionWordsIntoSentences(words: CaptionSegment[]): CaptionSegment[] {
  const result: CaptionSegment[] = []
  let group: CaptionSegment | null = null
  for (const word of words) {
    const clean = word.text.trimStart()
    const gap = group ? word.startMs - group.endMs : Infinity
    const shouldBreak = Boolean(group) && (
      gap >= 450 || group!.endMs - group!.startMs >= 4_000 ||
      group!.text.length + clean.length > 34 || /[。！？!?；;]$/.test(group!.text.trim())
    )
    if (!group || shouldBreak) {
      if (group) result.push(group)
      group = { ...word, id: `caption-${result.length + 1}-${word.startMs}`, text: clean }
      continue
    }
    const joiner: string = /[\u3400-\u9fff]$/.test(group.text) || /^[，。！？、；：,.!?;:]/.test(clean) ? '' : ' '
    group = { ...group, endMs: word.endMs, text: `${group.text}${joiner}${clean}` }
  }
  if (group) result.push(group)
  return result
}

function parseTimestamp(value: string): number {
  const match = /^(\d+):(\d+):(\d+)[,.](\d+)$/.exec(value.trim())
  if (!match) return NaN
  return Number(match[1]) * 3_600_000 + Number(match[2]) * 60_000 +
    Number(match[3]) * 1000 + Number(match[4].padEnd(3, '0').slice(0, 3))
}
