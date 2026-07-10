import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'

import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fb-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-fb-surface disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-fb-accent text-white hover:brightness-110 active:brightness-95 shadow-[0_4px_12px_rgba(91,91,214,0.35)]',
        destructive: 'bg-cat-distract text-white hover:brightness-110 active:brightness-95 shadow-sm',
        outline: 'border border-fb-border bg-transparent text-fb-text hover:bg-fb-surface2 hover:border-fb-accent',
        secondary: 'bg-fb-surface2 text-fb-text hover:brightness-95 border border-fb-border',
        ghost: 'hover:bg-fb-surface2 text-fb-muted hover:text-fb-text',
        link: 'text-fb-accent underline-offset-4 hover:underline hover:brightness-110'
      },
      size: {
        default: 'h-9 px-3 py-2',
        sm: 'h-8 rounded-lg px-2.5 py-1.5',
        lg: 'h-10 rounded-lg px-4 py-2.5',
        icon: 'h-9 w-9'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
})
Button.displayName = 'Button'

export { Button, buttonVariants }
