import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:scale-105",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-primary",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-md hover:shadow-secondary",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-md hover:shadow-secondary",
        outline: "text-foreground border-primary/50 hover:bg-primary/10",
        accent:
          "border-transparent bg-accent text-accent-foreground hover:bg-accent/90 shadow-md hover:shadow-accent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
