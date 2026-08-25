/**
 * 字幕纯逻辑冒烟：
 *   TSX_TSCONFIG_PATH=tsconfig.web.json npx -y tsx scripts/captions.smoke.ts
 */
import { DEFAULT_CAPTION_STYLE, validateCaptionsDocument, type CaptionsDocument } from '../shared/captions'
import {
  groupCaptionWordsIntoSentences,
  parseWhisperProgress,
  parseWhisperSrt
} from '../shared/transcription'
import {
  mapCaptionsThroughCuts,
  mergeCaptionSegments,
  normalizeCaptionSegments,
  splitCaptionSegment
} from '../src/captions/operations'
import { serializeSrt } from '../src/captions/srt'

let failures = 0
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) console.log(`ok   ${name}`)
  else { failures += 1; console.error(`FAIL ${name} ${detail}`) }
}

const document: CaptionsDocument = {
  version: 1,
  source: 'mic',
  language: 'zh',
  style: DEFAULT_CAPTION_STYLE,
  enabled: true,
  segments: [
    { id: 'a', startMs: 1000, endMs: 3000, text: '第一句' },
    { id: 'b', startMs: 4000, endMs: 7000, text: '第二句' }
  ],
  updatedAt: '2026-08-25T00:00:00.000Z'
}

check('合法字幕文档通过 schema', validateCaptionsDocument(document, 8000).length === 0)
check('越界字幕被 schema 拒绝', validateCaptionsDocument({
  ...document,
  segments: [{ ...document.segments[0], endMs: 9000 }]
}, 8000).some((error) => error.includes('范围')))

const normalized = normalizeCaptionSegments([
  { id: 'b', startMs: 2500, endMs: 4000, text: ' B ' },
  { id: 'a', startMs: 1000, endMs: 3000, text: ' A ' }
], 5000)
check('字幕排序、去空格并消除重叠', normalized[0].text === 'A' && normalized[1].startMs === 3000)

const split = splitCaptionSegment(document.segments[0], 2000)
check('字幕分割保持连续', split.length === 2 && split[0].endMs === split[1].startMs)
const merged = mergeCaptionSegments(split[0], split[1])
check('字幕合并恢复区间和文本', merged.startMs === 1000 && merged.endMs === 3000 && merged.text.includes('第一句'))

const mapped = mapCaptionsThroughCuts(document.segments, [{ startMs: 2000, endMs: 5000 }], 8000)
check('跨裁剪字幕按保留段分割并映射', mapped.length === 2 && mapped[0].endMs === 2000 && mapped[1].startMs === 2000, JSON.stringify(mapped))
const srt = serializeSrt(document.segments, [{ startMs: 2000, endMs: 5000 }], 8000)
check('SRT 时间递增且使用逗号毫秒', srt.includes('00:00:01,000 --> 00:00:02,000') && srt.includes('00:00:02,000 --> 00:00:04,000'))

check('helper 进度解析并钳制', parseWhisperProgress('progress = 120%') === 1)
const helperSegments = parseWhisperSrt('1\n00:00:00,000 --> 00:00:10,500\nHello world.\n')
check('helper SRT 结果解析', helperSegments.length === 1 && helperSegments[0].endMs === 10_500)
const grouped = groupCaptionWordsIntoSentences([
  { id: 'w1', startMs: 100, endMs: 300, text: '你好' },
  { id: 'w2', startMs: 320, endMs: 520, text: '世界。' },
  { id: 'w3', startMs: 1100, endMs: 1300, text: '下一句' }
])
check('词级时间戳按标点和停顿重组为句', grouped.length === 2 && grouped[0].text === '你好世界。' && grouped[1].startMs === 1100)

console.log(failures === 0 ? '\n全部通过' : `\n${failures} 项失败`)
process.exit(failures === 0 ? 0 : 1)
