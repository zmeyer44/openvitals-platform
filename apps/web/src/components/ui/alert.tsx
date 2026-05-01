import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Info, CheckCircle2, AlertTriangle, AlertCircle, X } from "lucide-react";
import { cn } from "../../lib/cn";

const alertVariants = cva(
  "relative w-full rounded-[8px] border px-3.5 py-3 text-[13px]",
  {
    variants: {
      variant: {
        info: "bg-info-soft border-info/15 text-info-foreground [&>svg]:text-info",
        success: "bg-success-soft border-success/15 text-success-foreground [&>svg]:text-success",
        warning: "bg-warning-soft border-warning/15 text-warning-foreground [&>svg]:text-warning",
        danger: "bg-danger-soft border-danger/15 text-danger-foreground [&>svg]:text-danger",
        neutral: "bg-surface border-line text-ink-2 [&>svg]:text-muted"
      }
    },
    defaultVariants: { variant: "info" }
  }
);

const variantIcons = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertCircle,
  neutral: Info
} as const;

interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  icon?: React.ReactNode | false;
  onDismiss?: () => void;
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "info", icon, onDismiss, children, ...props }, ref) => {
    const Icon = variant ? variantIcons[variant] : Info;
    return (
      <div
        ref={ref}
        role="alert"
        className={cn(alertVariants({ variant }), className)}
        {...props}
      >
        <div className="flex items-start gap-2.5">
          {icon !== false &&
            (icon ?? <Icon className="size-[18px] shrink-0 mt-px" strokeWidth={2} />)}
          <div className="flex-1 min-w-0">{children}</div>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="size-5 -m-0.5 rounded-[4px] inline-flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }
);
Alert.displayName = "Alert";

export function AlertTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h5
      className={cn(
        "font-semibold leading-tight tracking-[-0.005em] text-[13px]",
        className
      )}
      {...props}
    />
  );
}

export function AlertDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("mt-1 text-[12.5px] leading-snug opacity-90", className)}
      {...props}
    />
  );
}
