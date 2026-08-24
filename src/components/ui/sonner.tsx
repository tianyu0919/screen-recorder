import { Toaster as Sonner, type ToasterProps } from 'sonner'

/** shadcn Sonner 适配：沿用 Lenza 语义色板，供全局非阻塞反馈使用。 */
export function Toaster(props: ToasterProps): React.JSX.Element {
  return (
    <Sonner
      className="app-nodrag toaster group !pointer-events-auto"
      toastOptions={{
        classNames: {
          toast: 'app-nodrag !pointer-events-auto !border-line-strong !bg-surface-1 !text-ink-1 !shadow-float',
          content: '!min-w-0',
          title: '!text-[14px] !font-semibold !leading-5',
          description: '!text-ink-2',
          actionButton: '!pointer-events-auto !h-8 !cursor-pointer !px-3 !bg-accent !text-on-accent hover:!bg-accent-hover active:!scale-[0.98]',
          cancelButton: '!pointer-events-auto !h-8 !cursor-pointer !px-3 !bg-surface-3 !text-ink-1 hover:!bg-surface-2 active:!scale-[0.98]',
          closeButton: '!left-auto !right-3 !top-3 !h-7 !w-7 !transform-none !rounded-lg !border-transparent !bg-transparent !text-ink-3 hover:!border-line hover:!bg-surface-3 hover:!text-ink-1 active:!scale-[0.94]'
        }
      }}
      {...props}
    />
  )
}
