import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground dark:placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus:border-cyber-purple focus:ring-cyber-purple/40 dark:focus:border-cyber-light-purple dark:focus:ring-cyber-light-purple/40 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:text-white dark:bg-[#252440] dark:border-[#2d2b55] hover:border-cyber-purple/30 dark:hover:border-cyber-light-purple/30 transition-colors",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
