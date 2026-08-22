import type { ReactElement } from 'react'
import { Keyboard, MousePointer2 } from 'lucide-react'
import type { EventDisplayCluster, TimelineEventItem } from '@/timeline/eventDisplay'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface TimelineEventTooltipProps {
  cluster: EventDisplayCluster
  children: ReactElement
}

function EventIcon({ item }: { item: TimelineEventItem }): React.JSX.Element {
  const Icon = item.kind === 'click' ? MousePointer2 : Keyboard
  return (
    <span className="grid h-5 w-5 flex-none place-items-center rounded-md bg-accent-soft text-accent">
      <Icon size={11} strokeWidth={2} />
    </span>
  )
}

export function TimelineEventTooltip({
  cluster,
  children
}: TimelineEventTooltipProps): React.JSX.Element {
  const visible = cluster.items.slice(0, 6)
  const remaining = cluster.items.length - visible.length

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" sideOffset={8} collisionPadding={12} className="w-[220px] p-2.5">
        <div className="mb-2 flex items-center justify-between gap-3 px-0.5">
          <span className="text-[11px] font-semibold text-ink-1">
            {cluster.items.length === 1 ? '事件详情' : `${cluster.items.length} 个聚合事件`}
          </span>
          <span className="font-mono text-[10px] text-ink-3">
            {(cluster.t / 1000).toFixed(2)}s
          </span>
        </div>
        <div className="flex flex-col gap-1">
          {visible.map((item) => (
            <div key={item.id} className="flex items-center gap-2 rounded-lg bg-surface-2 px-2 py-1.5">
              <EventIcon item={item} />
              <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-ink-1">
                {item.label}
              </span>
              <span className="flex-none font-mono text-[9.5px] text-ink-3">
                {(item.t / 1000).toFixed(2)}s
              </span>
            </div>
          ))}
        </div>
        {remaining > 0 && (
          <p className="mt-1.5 px-1 text-[10px] text-ink-3">另外还有 {remaining} 个事件</p>
        )}
        <p className="mt-2 border-t border-line px-1 pt-2 text-[10px] text-ink-3">
          点击跳转 · 右键管理
        </p>
      </TooltipContent>
    </Tooltip>
  )
}
