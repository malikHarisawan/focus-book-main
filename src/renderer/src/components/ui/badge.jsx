import * as React from 'react'
import { cva } from 'class-variance-authority'

import { cn } from '../../lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-meta-blue-500/30 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-meta-blue-500 text-white hover:bg-meta-blue-600',
        secondary:
          'border-transparent bg-meta-gray-100 dark:bg-meta-gray-700 text-meta-gray-700 dark:text-meta-gray-200 hover:bg-meta-gray-200 dark:hover:bg-meta-gray-600',
        destructive:
          'border-transparent bg-meta-red-500 text-white hover:bg-meta-red-600',
        outline: 'text-meta-gray-700 dark:text-meta-gray-300 border-meta-gray-300 dark:border-meta-gray-600'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
