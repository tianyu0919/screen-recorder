import assert from 'node:assert/strict'
import { normalizeRecordingEvents, type RecordingEventsV2 } from '../shared/eventsV2'
import { validateRecordingEvents, type RecordingEvents } from '../shared/types'
import { fitRectCentered } from '../src/lib/aspectFit'
import { geometryAt, screenPointToCanvas } from '../src/timeline/windowGeometry'

const placement = fitRectCentered(2560, 1440, 800, 800)
assert.deepEqual(placement, { x: 560, y: 0, width: 1440, height: 1440 })

const held = geometryAt([
  [0, 10, 20, 800, 600],
  [999, 10, 20, 800, 600],
  [1000, 110, 20, 800, 600]
], 500)
assert.deepEqual(held, { x: 10, y: 20, width: 800, height: 600 })

const interpolated = geometryAt([
  [0, 0, 0, 100, 100],
  [100, 100, 50, 200, 100]
], 50)
assert.deepEqual(interpolated, { x: 50, y: 25, width: 150, height: 100 })

const windowEvents: RecordingEventsV2 = {
  version: 2,
  startTime: 1,
  display: { id: 1, bounds: [-1920, 0, 1920, 1080], scaleFactor: 1 },
  source: {
    type: 'window',
    id: 'window:1:0',
    fixedCanvas: { width: 1920, height: 1080 },
    windowGeometry: [[0, -1800, 100, 800, 600]]
  },
  video: { width: 1920, height: 1080, fps: 60, file: 'screen.webm' },
  mouseTrack: [],
  clicks: [],
  keys: []
}
assert.deepEqual(screenPointToCanvas(windowEvents, 0, -1400, 400), { x: 960, y: 540 })
assert.equal(screenPointToCanvas(windowEvents, 0, -1900, 400), null)
assert.deepEqual(validateRecordingEvents(windowEvents), [])

const v1: RecordingEvents = {
  version: 1,
  startTime: 1,
  display: { id: 1, bounds: [0, 0, 1920, 1080], scaleFactor: 1 },
  video: { width: 1920, height: 1080, fps: 60, file: 'screen.webm' },
  mouseTrack: [],
  clicks: [],
  keys: []
}
const normalized = normalizeRecordingEvents(v1)
assert.equal(normalized.version, 2)
assert.equal(normalized.source.type, 'screen')
assert.deepEqual(normalized.source.fixedCanvas, { width: 1920, height: 1080 })

const unsorted = structuredClone(windowEvents)
unsorted.source.windowGeometry = [
  [10, 0, 0, 100, 100],
  [5, 0, 0, 100, 100]
]
assert.ok(validateRecordingEvents(unsorted).some((error) => error.includes('windowGeometry')))

const notFinite = structuredClone(windowEvents)
notFinite.source.windowGeometry = [[0, Number.NaN, 0, 100, 100]]
assert.ok(validateRecordingEvents(notFinite).some((error) => error.includes('windowGeometry')))

console.log('window geometry smoke passed')
