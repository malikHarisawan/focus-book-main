import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'

import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5051F9]/30 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-[#5051F9] text-white hover:bg-[#4142E0] active:bg-[#4142E0] shadow-sm',
        destructive: 'bg-[#FF6B6B] text-white hover:bg-[#E65C5C] active:bg-[#E65C5C] shadow-sm',
        outline: 'border border-[#E8EDF1] dark:border-[#282932] bg-transparent text-[#232360] dark:text-white hover:bg-[#F4F7FE] dark:hover:bg-[#282932]',
        secondary: 'bg-[#F4F7FE] dark:bg-[#282932] text-[#232360] dark:text-white hover:bg-[#E8EDF1] dark:hover:bg-[#212329]',
        ghost: 'hover:bg-[#F4F7FE] dark:hover:bg-[#282932] text-[#768396] dark:text-[#898999] hover:text-[#232360] dark:hover:text-white',
        link: 'text-[#5051F9] underline-offset-4 hover:underline hover:text-[#4142E0]'
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
