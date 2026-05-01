import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

const badgeVariants = cva(
  [
    "inline-flex items-center gap-1 font-medium tabular-nums",
    "[&_svg]:shrink-0 transition-colors"
  ].join(" "),
  {
    variants: {
      variant: {
        neutral: "bg-surface-strong text-ink-2 border border-line/60",
        muted: "bg-surface-muted text-muted border border-line/60",
        outline: "bg-transparent text-ink-2 border border-line-strong",
        success: "bg-success-soft text-success-foreground border border-success/15",
        warning: "bg-warning-soft text-warning-foreground border border-warning/15",
        danger: "bg-danger-soft text-danger-foreground border border-danger/15",
        info: "bg-info-soft text-info-foreground border border-info/15",
        accent: "bg-accent-soft text-accent-soft-foreground border border-accent/15",
        solid: "bg-ink text-canvas border border-transparent"
      },
      size: {
        sm: "h-5 px-1.5 text-[11px] rounded-[4px] [&_svg]:size-3",
        md: "h-[22px] px-1.5 text-[11.5px] rounded-[5px] [&_svg]:size-3",
        lg: "h-6 px-2 text-[12px] rounded-[5px] [&_svg]:size-3.5"
      }
    },
    defaultVariants: { variant: "neutral", size: "md" }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({
  className,
  variant,
  size,
  dot,
  children,
  ...props
}: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            "size-1.5 rounded-full",
            variant === "success" && "bg-success",
            variant === "warning" && "bg-warning",
            variant === "danger" && "bg-danger",
            variant === "info" && "bg-info",
            variant === "accent" && "bg-accent",
            (variant === "neutral" || variant === "muted" || variant === "outline" || !variant) &&
              "bg-muted",
            variant === "solid" && "bg-canvas"
          )}
        />
      )}
      {children}
    </span>
  );
}

export { badgeVariants };
