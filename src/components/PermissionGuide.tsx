import { useAppStore } from '@/store/appStore'
import { Button } from '@/components/ui/button'
import { CheckCircle2, CircleAlert, ExternalLink, RefreshCw, ShieldAlert } from 'lucide-react'

/** macOS 权限引导页（Task 2.4）：屏幕录制 / 辅助功能 / 麦克风 */
export function PermissionGuide(): React.JSX.Element {
  const { permissions, refreshPermissions, setWithMic, microphonePermissionPending } = useAppStore()
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
    <section
      aria-labelledby="permission-guide-title"
      className="permission-guide relative mb-5 overflow-hidden rounded-xl border shadow-card"
    >
      <span className="absolute inset-y-0 left-0 w-1 bg-warning" aria-hidden="true" />

      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line py-4 pl-6 pr-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="permission-guide-icon flex h-9 w-9 flex-none items-center justify-center rounded-[10px] border text-warning">
            <ShieldAlert size={18} aria-hidden="true" />
          </span>
          <div>
            <h2 id="permission-guide-title" className="text-[15px] font-semibold leading-5">
              完成权限设置
            </h2>
            <p className="mt-0.5 max-w-[760px] text-[12.5px] leading-5 text-ink-2">
              授权后重新检查。麦克风是可选项；关闭麦克风仍可正常录制。缺少辅助功能权限时不会采集点击和键盘事件。
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refreshPermissions()}>
          <RefreshCw size={13} aria-hidden="true" />
          重新检查
        </Button>
      </header>

      <ul className="grid gap-2.5 py-4 pl-6 pr-5 md:grid-cols-3">
        {items.map((item) => {
          const state = permissions[item.key]
          const granted = state === 'granted'
          return (
            <li
              key={item.key}
              className="flex min-h-[104px] flex-col rounded-[10px] border border-line bg-surface-1 p-3"
            >
              <div className="flex items-start gap-2.5">
                {granted ? (
                  <CheckCircle2 className="mt-0.5 flex-none text-success" size={15} aria-hidden="true" />
                ) : (
                  <CircleAlert className="mt-0.5 flex-none text-warning" size={15} aria-hidden="true" />
                )}
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold leading-5">
                    {item.label}
                    <span className={granted ? 'ml-2 text-xs font-medium text-success' : 'ml-2 text-xs font-medium text-warning'}>
                      {granted ? '已授权' : '待授权'}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs leading-[18px] text-ink-2">{item.desc}</p>
                </div>
              </div>
              {!granted && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-auto self-start"
                  disabled={item.key === 'microphone' && microphonePermissionPending}
                  onClick={() => {
                    if (item.key === 'microphone') void setWithMic(true)
                    else void window.api.openSystemSettings(item.key)
                  }}
                >
                  {item.key === 'microphone' && permissions.microphone === 'unknown'
                    ? microphonePermissionPending
                      ? '正在申请…'
                      : '授权麦克风'
                    : '打开系统设置'}
                  <ExternalLink size={12} aria-hidden="true" />
                </Button>
              )}
              {granted && (
                <span className="mt-auto text-[11px] font-medium text-ink-3">无需操作</span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
