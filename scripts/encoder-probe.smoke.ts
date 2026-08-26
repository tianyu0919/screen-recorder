/**
 * 编码探测顺序冒烟：
 *   TSX_TSCONFIG_PATH=tsconfig.web.json npx tsx scripts/encoder-probe.smoke.ts
 */
import { probeVideoEncoder } from '../src/export/encoder'

let failures = 0
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) console.log(`ok   ${name}`)
  else {
    failures++
    console.error(`FAIL ${name} ${detail}`)
  }
}

async function main(): Promise<void> {
  const h264Queries: VideoEncoderConfig[] = []
  const mp4 = await probeVideoEncoder({ width: 5120, height: 2880 }, async (config) => {
    h264Queries.push(config)
    return config.codec.startsWith('avc1.') && config.width === 3840
  })
  check(
    '5K H.264 不支持时继续降档并保留 MP4',
    mp4.format === 'mp4' && mp4.config.width === 3840 && mp4.config.height === 2160,
    JSON.stringify(mp4)
  )
  check(
    '找到降档 H.264 前不探测 VP9',
    h264Queries.every((config) => config.codec.startsWith('avc1.')),
    h264Queries.map((config) => config.codec).join(', ')
  )

  const fallbackQueries: VideoEncoderConfig[] = []
  const webm = await probeVideoEncoder({ width: 5120, height: 2880 }, async (config) => {
    fallbackQueries.push(config)
    return config.codec.startsWith('vp09')
  })
  const firstVp9 = fallbackQueries.findIndex((config) => config.codec.startsWith('vp09'))
  check('全部 H.264 尺寸失败后才 fallback WebM', webm.format === 'webm' && firstVp9 > 0)
  check(
    'VP9 前的探测全部为 H.264',
    fallbackQueries.slice(0, firstVp9).every((config) => config.codec.startsWith('avc1.'))
  )

  if (failures > 0) process.exitCode = 1
}

void main()
