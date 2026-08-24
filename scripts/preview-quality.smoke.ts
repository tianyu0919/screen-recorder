import { normalizePreviewQuality } from '../shared/types'
import { previewQualityProfile, previewRenderSize } from '../src/lib/stageFit'
import { PreviewPerformanceMonitor } from '../src/lib/previewPerformance'

let failures = 0
function check(name: string, condition: boolean): void {
  if (condition) console.log(`ok   ${name}`)
  else { failures += 1; console.error(`FAIL ${name}`) }
}

check('旧设置缺少预览清晰度时回退自动', normalizePreviewQuality(undefined) === 'auto')
check('非法预览清晰度回退自动', normalizePreviewQuality('maximum') === 'auto')
check('合法预览清晰度保持不变', normalizePreviewQuality('ultra') === 'ultra')

const autoRetina = previewQualityProfile('auto', 2)
check('Retina 自动档最高 1080p', autoRetina.pixelRatio === 2 && autoRetina.maxSize.width === 1920)
const autoStandard = previewQualityProfile('auto', 1)
check('普通屏自动档保持 720p 上限', autoStandard.pixelRatio === 1 && autoStandard.maxSize.width === 1280)
check('高清档使用 1.5x/1080p', previewQualityProfile('high', 1).pixelRatio === 1.5)
check('超清档使用 2x/1440p', previewQualityProfile('ultra', 1).maxSize.height === 1440)
const smallOutput = previewRenderSize(
  { width: 1600, height: 900 },
  { width: 960, height: 540 },
  previewQualityProfile('ultra', 2).maxSize,
  64,
  2
)
check('超清 backing 不超过最终输出', smallOutput.width === 960 && smallOutput.height === 540)

function simulate(actualFps: number, expectedFps: number, durationMs: number): boolean {
  const monitor = new PreviewPerformanceMonitor()
  const step = 1000 / actualFps
  for (let now = 0; now <= durationMs; now += step) {
    if (monitor.sample(now, now, expectedFps)) return true
  }
  return false
}

check('预热阶段不报告卡顿', !simulate(20, 60, 2900))
check('持续 60fps 不报告卡顿', !simulate(60, 60, 5400))
check('持续 30fps 相对 60fps 报告卡顿', simulate(30, 60, 5400))

const discontinuous = new PreviewPerformanceMonitor()
for (let now = 0; now <= 4500; now += 1000 / 30) discontinuous.sample(now, now, 60)
check('seek 时间跳变后重新预热', discontinuous.sample(4550, 9000, 60) === null)
discontinuous.reset()
check('重置后不沿用旧窗口', discontinuous.sample(5000, 5000, 60) === null)

if (failures > 0) {
  console.error(`\n${failures} 项失败`)
  process.exit(1)
}
console.log('\n全部通过')
