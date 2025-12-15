import * as React from 'react'

import { cn } from '../../lib/utils'

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-xl border border-[#E8EDF1] dark:border-[#282932] bg-white dark:bg-[#282932] px-3 py-2 text-sm text-[#232360] dark:text-white placeholder:text-[#768396] dark:placeholder:text-[#768396] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5051F9]/30 focus-visible:border-[#5051F9] disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = 'Input'

export { Input }