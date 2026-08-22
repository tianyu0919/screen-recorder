import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-[10px] text-[13px] font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-accent text-on-accent font-semibold shadow-sm hover:bg-accent-hover hover:shadow-card',
        destructive: 'bg-danger text-on-accent hover:brightness-110',
        outline: 'border border-line bg-surface-1 text-ink-1 shadow-sm hover:border-line-strong hover:bg-surface-2',
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
