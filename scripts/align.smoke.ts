/**
 * 回声对齐冒烟：对最新真实录制会话跑 estimateSystemOffsetSec，
 * 预期输出非零偏移（该机实测 ~+0.183s）且 mic/system 都有内容。
 *   npx tsx scripts/align.smoke.ts [sessionDir]
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parseWav } from '../src/export/audio'
import { estimateSystemOffsetSec } from '../src/lib/audioAlign'

const dir =
  process.argv[2] ??
  (() => {
    const rec = join(homedir(), 'AppData/Roaming/screen-recorder/recordings')
    const latest = readdirSync(rec)
      .map((d) => join(rec, d))
      .filter((d) => existsSync(join(d, 'mic.wav')) && existsSync(join(d, 'system.wav')))
      .sort()
      .at(-1)
    if (!latest) throw new Error('找不到同时含 mic.wav / system.wav 的会话')
    return latest
  })()

console.log('session:', dir)
const mic = parseWav(readFileSync(join(dir, 'mic.wav')).buffer as ArrayBuffer)
const sys = parseWav(readFileSync(join(dir, 'system.wav')).buffer as ArrayBuffer)
console.log(`mic: ${(mic.samples.length / mic.channels / mic.sampleRate).toFixed(2)}s, sys: ${(sys.samples.length / sys.channels / sys.sampleRate).toFixed(2)}s`)

const offset = estimateSystemOffsetSec(mic, sys)
console.log(`估计偏移: ${(offset * 1000).toFixed(1)}ms（正=system 偏晚）`)
if (offset === 0) {
  console.error('FAIL: 期望非零偏移（该会话 mic 含外放系统音）')
  process.exit(1)
}
console.log('ok')
