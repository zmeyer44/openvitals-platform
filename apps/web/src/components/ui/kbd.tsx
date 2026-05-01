import * as React from "react";
import { cn } from "../../lib/cn";

export function Kbd({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1",
        "font-mono text-[10.5px] font-medium text-muted",
        "bg-surface border border-line rounded-[3.5px]",
        "shadow-[0_1px_0_0_rgb(15_14_12/0.04),inset_0_-1px_0_0_rgb(15_14_12/0.04)]",
        className
      )}
      {...props}
    >
      {children}
    </kbd>
  );
}

export function KbdGroup({
  keys,
  className
}: {
  keys: string[];
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {keys.map((k, i) => (
        <React.Fragment key={i}>
          <Kbd>{k}</Kbd>
          {i < keys.length - 1 && <span className="text-faint text-[10px]">+</span>}
        </React.Fragment>
      ))}
    </span>
  );
}
