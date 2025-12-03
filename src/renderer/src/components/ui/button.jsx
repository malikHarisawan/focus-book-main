import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'

import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-meta-blue-500/30 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-meta-blue-500 text-white hover:bg-meta-blue-600 active:bg-meta-blue-700 shadow-sm',
        destructive: 'bg-meta-red-500 text-white hover:bg-meta-red-600 active:bg-meta-red-700 shadow-sm',
        outline: 'border border-meta-gray-200 dark:border-meta-gray-700 bg-transparent text-meta-gray-700 dark:text-meta-gray-200 hover:bg-meta-gray-100 dark:hover:bg-meta-gray-800',
        secondary: 'bg-meta-gray-100 dark:bg-meta-gray-800 text-meta-gray-700 dark:text-meta-gray-200 hover:bg-meta-gray-200 dark:hover:bg-meta-gray-700',
        ghost: 'hover:bg-meta-gray-100 dark:hover:bg-meta-gray-800 text-meta-gray-600 dark:text-meta-gray-400 hover:text-meta-gray-900 dark:hover:text-meta-gray-100',
        link: 'text-meta-blue-500 underline-offset-4 hover:underline hover:text-meta-blue-600'
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-lg px-3',
        lg: 'h-11 rounded-lg px-8',
        icon: 'h-10 w-10'
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
