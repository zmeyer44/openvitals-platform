import * as React from "react";
import { cn } from "../../lib/cn";

interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-6 py-10",
        "bg-surface-muted/40 rounded-[10px] border border-dashed border-line",
        className
      )}
      {...props}
    >
      {icon && (
        <div className="mb-3 size-10 rounded-[8px] bg-surface border border-line shadow-xs flex items-center justify-center text-muted [&_svg]:size-[18px]">
          {icon}
        </div>
      )}
      <h3 className="text-[14px] font-semibold text-ink tracking-[-0.01em]">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-[12.5px] text-muted leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
