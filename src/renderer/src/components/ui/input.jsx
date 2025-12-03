import * as React from 'react'

import { cn } from '../../lib/utils'

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-lg border border-meta-gray-200 dark:border-meta-gray-700 bg-white dark:bg-meta-gray-800 px-3 py-2 text-sm text-meta-gray-900 dark:text-dark-text-primary placeholder:text-meta-gray-400 dark:placeholder:text-meta-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-meta-blue-500/30 focus-visible:border-meta-blue-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = 'Input'

export { Input }