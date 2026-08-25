/**
 * 录像显示名称纯逻辑冒烟：
 *   TSX_TSCONFIG_PATH=tsconfig.web.json npx -y tsx scripts/session-name.smoke.ts
 */
import {
  normalizeSessionDisplayName,
  SESSION_DISPLAY_NAME_MAX_LENGTH,
  validateSessionDisplayName
} from '../shared/sessionName'

let failures = 0
function check(name: string, condition: boolean): void {
  if (condition) console.log(`ok   ${name}`)
  else { failures += 1; console.error(`FAIL ${name}`) }
}

check('中文和空格名称可用', validateSessionDisplayName('产品演示 01') === null)
check('保存时清理首尾空格', normalizeSessionDisplayName('  产品演示  ') === '产品演示')
check('空名称被拒绝', validateSessionDisplayName('   ') !== null)
check('跨平台非法字符被拒绝', validateSessionDisplayName('演示/版本:1') !== null)
check('尾随句点被拒绝', validateSessionDisplayName('演示.') !== null)
check('Windows 保留名称被拒绝', validateSessionDisplayName('CON') !== null)
check('超长名称被拒绝', validateSessionDisplayName('a'.repeat(SESSION_DISPLAY_NAME_MAX_LENGTH + 1)) !== null)
check('sessionId 可作为安全回退', validateSessionDisplayName('rec-1787665954071-89akha') === null)

console.log(failures === 0 ? '\n全部通过' : `\n${failures} 项失败`)
process.exit(failures === 0 ? 0 : 1)
