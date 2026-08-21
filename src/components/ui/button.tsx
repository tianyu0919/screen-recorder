import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-[13px] font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-accent text-white font-semibold hover:bg-accent-hover',
        destructive: 'bg-red-600 text-white hover:bg-red-500',
        outline: 'border border-line bg-surface-2 text-ink-1 hover:bg-surface-3',
        ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink-1'
      },
      size: {
        default: 'h-8 px-3.5',
        sm: 'h-7 px-2.5 text-xs',
        lg: 'h-10 px-6'
      }
    },
    defaultVariants: { variant: 'default', size: 'default' }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  )
)
Button.displayName = 'Button'
