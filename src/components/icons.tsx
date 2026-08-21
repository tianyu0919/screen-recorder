import { cn } from '@/lib/utils'

interface IconProps {
  size?: number
  className?: string
  strokeWidth?: number
}

function base({
  size = 15,
  className,
  strokeWidth = 1.7,
  children
}: IconProps & { children: React.ReactNode }): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('flex-none', className)}
    >
      {children}
    </svg>
  )
}

export const MonitorIcon = (p: IconProps): React.JSX.Element =>
  base({
    ...p,
    children: (
      <>
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </>
    )
  })

export const AppWindowIcon = (p: IconProps): React.JSX.Element =>
  base({
    ...p,
    children: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2.5" />
        <path d="M3 9h18" />
      </>
    )
  })

export const MicIcon = (p: IconProps): React.JSX.Element =>
  base({
    ...p,
    children: (
      <>
        <rect x="9" y="2" width="6" height="12" rx="3" />
        <path d="M5 10a7 7 0 0 0 14 0M12 19v3" />
      </>
    )
  })

export const AudioLinesIcon = (p: IconProps): React.JSX.Element =>
  base({ ...p, children: <path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" /> })

export const FolderIcon = (p: IconProps): React.JSX.Element =>
  base({
    ...p,
    children: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  })

export const DownloadIcon = (p: IconProps): React.JSX.Element =>
  base({ ...p, strokeWidth: 2, children: <path d="M12 3v12M7 10l5 5 5-5M4 21h16" /> })

export const PlayIcon = (p: IconProps): React.JSX.Element =>
  base({ ...p, children: <path d="M7 4l14 8-14 8z" /> })

export const PauseIcon = (p: IconProps): React.JSX.Element =>
  base({ ...p, children: <path d="M7 4h4v16H7zM13 4h4v16h-4z" /> })

export const ChevronLeftIcon = (p: IconProps): React.JSX.Element =>
  base({ ...p, strokeWidth: 2, children: <path d="M15 18l-6-6 6-6" /> })

export const RefreshIcon = (p: IconProps): React.JSX.Element =>
  base({
    ...p,
    children: (
      <>
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </>
    )
  })

export const CheckIcon = (p: IconProps): React.JSX.Element =>
  base({ ...p, strokeWidth: 3.2, children: <path d="M20 6 9 17l-5-5" /> })

export const ArrowRightIcon = (p: IconProps): React.JSX.Element =>
  base({ ...p, strokeWidth: 2.2, children: <path d="M5 12h14M13 6l6 6-6 6" /> })

export const CloseIcon = (p: IconProps): React.JSX.Element =>
  base({ ...p, strokeWidth: 2, children: <path d="M18 6 6 18M6 6l12 12" /> })

export const MinusIcon = (p: IconProps): React.JSX.Element =>
  base({ ...p, strokeWidth: 2, children: <path d="M5 12h14" /> })

export const SunIcon = (p: IconProps): React.JSX.Element =>
  base({
    ...p,
    children: (
      <>
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.5 12h2M19.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>
    )
  })

export const MoonIcon = (p: IconProps): React.JSX.Element =>
  base({ ...p, children: <path d="M20 13.5A8.5 8.5 0 0 1 10.5 4 7 7 0 1 0 20 13.5z" /> })

export const MaximizeIcon = (p: IconProps): React.JSX.Element =>
  base({ ...p, children: <rect x="5" y="5" width="14" height="14" rx="2" /> })

export const RestoreIcon = (p: IconProps): React.JSX.Element =>
  base({
    ...p,
    children: (
      <>
        <rect x="5" y="9" width="10" height="10" rx="2" />
        <path d="M9 9V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2" />
      </>
    )
  })

export const PanelRightIcon = (p: IconProps): React.JSX.Element =>
  base({
    ...p,
    children: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2.5" />
        <path d="M15 4v16" />
      </>
    )
  })
