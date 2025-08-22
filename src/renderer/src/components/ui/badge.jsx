import * as React from 'react'
import { cva } from 'class-variance-authority'

import { cn } from '../../lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-cyan-600 text-white hover:bg-cyan-700',
        secondary:
          'border-transparent bg-gray-700 text-cyan-400 hover:bg-gray-600',
        destructive:
          'border-transparent bg-red-600 text-white hover:bg-red-700',
        outline: 'text-cyan-400 border-cyan-400'
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
