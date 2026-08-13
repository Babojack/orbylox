import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // TaskNow: eckig, fett, klare Kante statt Schatten.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none text-sm font-bold tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-black text-white border-2 border-black hover:bg-[#ef5a24] hover:border-[#ef5a24] dark:bg-white dark:text-black dark:border-white dark:hover:bg-[#ef5a24] dark:hover:text-white dark:hover:border-[#ef5a24]",
        accent:
          "bg-[#ef5a24] text-white border-2 border-[#ef5a24] hover:bg-black hover:border-black",
        destructive:
          "bg-red-600 text-white border-2 border-red-600 hover:bg-black hover:border-black",
        outline:
          "border-2 border-black bg-transparent text-black hover:bg-black hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black",
        secondary:
          "bg-white text-black border-2 border-black hover:bg-black hover:text-white dark:bg-transparent dark:text-white dark:border-white",
        ghost: "border-2 border-transparent hover:border-black hover:bg-transparent dark:hover:border-white",
        link: "text-[#ef5a24] underline-offset-4 hover:underline border-0",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-8 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    (<Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props} />)
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }
