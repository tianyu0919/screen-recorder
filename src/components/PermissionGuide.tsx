import { useAppStore } from '@/store/appStore'
import { Button } from '@/components/ui/button'

/** macOS 权限引导页（Task 2.4）：屏幕录制 / 辅助功能 / 麦克风 */
export function PermissionGuide(): React.JSX.Element {
  const { permissions, refreshPermissions } = useAppStore()
  if (!permissions) return <></>

  const items: Array<{
    key: 'screen' | 'accessibility' | 'microphone'
    label: string
    desc: string
  }> = [
    { key: 'screen', label: '屏幕录制', desc: '必需：用于采集屏幕画面' },
    { key: 'accessibility', label: '辅助功能', desc: '用于全局采集点击/键盘事件（自动运镜的数据源）' },
    { key: 'microphone', label: '麦克风', desc: '可选：录制旁白音频' }
  ]

  return (
    <div className="mb-5 rounded-xl border border-amber-700/50 bg-amber-950/30 p-5">
      <h2 className="mb-1 text-[15px] font-semibold">需要系统权限</h2>
      <p className="mb-4 text-[13px] text-ink-2">
        授权后请点击「重新检查」。未授权辅助功能权限时仍可录制，但点击/键盘事件不会采集，自动运镜不可用。
      </p>
      <ul className="mb-4 space-y-3">
        {items.map((item) => {
          const state = permissions[item.key]
          const granted = state === 'granted'
          return (
            <li key={item.key} className="flex items-center justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 text-[13px] font-medium">
                  <span
                    className={
                      granted
                        ? 'h-1.5 w-1.5 rounded-full bg-[#30d158]'
                        : 'h-1.5 w-1.5 rounded-full bg-[#ffd60a]'
                    }
                  />
                  {item.label}
                </p>
                <p className="pl-3.5 text-xs text-ink-3">{item.desc}</p>
              </div>
              {!granted && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void window.api.openSystemSettings(item.key)}
                >
                  打开系统设置
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      <Button variant="outline" size="sm" onClick={() => void refreshPermissions()}>
        重新检查
      </Button>
    </div>
  )
}
