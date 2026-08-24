import {
  microphoneCaptureFailed,
  microphoneIntent,
  reconcileMicrophoneEnabled
} from '../src/lib/microphonePermission.ts'
import type { PermissionStatus } from '../shared/types.ts'

let failures = 0

function check(name: string, condition: boolean): void {
  if (condition) console.log(`ok   ${name}`)
  else {
    failures++
    console.error(`FAIL ${name}`)
  }
}

const granted: PermissionStatus = {
  screen: 'granted',
  accessibility: 'granted',
  microphone: 'granted'
}

check('首次发现已授权时默认启用麦克风', reconcileMicrophoneEnabled(null, 'granted', false))
check('未授权时强制关闭麦克风', !reconcileMicrophoneEnabled(granted, 'denied', true))
check('权限撤销后强制关闭麦克风', !reconcileMicrophoneEnabled(granted, 'unknown', true))
check('用户主动关闭后刷新仍保持关闭', !reconcileMicrophoneEnabled(granted, 'granted', false))
check('已授权直接启用', microphoneIntent('granted') === 'enable')
check('未决定时主动申请', microphoneIntent('unknown') === 'request')
check('已拒绝时跳转设置', microphoneIntent('denied') === 'settings')
check('请求麦克风但采集失败时进入降级反馈', microphoneCaptureFailed(true, false))
check('关闭麦克风时不产生采集失败反馈', !microphoneCaptureFailed(false, false))

if (failures > 0) process.exitCode = 1
