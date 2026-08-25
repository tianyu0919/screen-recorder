import type { CaptionsDocument } from '@shared/captions'
import { migrateCaptionsDocument, validateCaptionsDocument } from '@shared/captions'

export class CaptionsDocumentError extends Error {
  constructor(message: string) { super(message); this.name = 'CaptionsDocumentError' }
}

export function parseCaptionsDocument(json: string, durationMs = Infinity): CaptionsDocument {
  let value: unknown
  try { value = JSON.parse(json) } catch { throw new CaptionsDocumentError('captions.json 不是合法 JSON') }
  value = migrateCaptionsDocument(value)
  const errors = validateCaptionsDocument(value, durationMs)
  if (errors.length) throw new CaptionsDocumentError(`字幕数据损坏：${errors.join('；')}`)
  return value as CaptionsDocument
}
