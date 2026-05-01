import * as React from "react";
import { cn } from "../../lib/cn";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[6px] bg-surface-strong",
        "before:absolute before:inset-0 before:-translate-x-full",
        "before:animate-[shimmer_1.6s_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent dark:before:via-white/5",
        className
      )}
      {...props}
    />
  );
}

if (typeof document !== "undefined" && !document.getElementById("ov-shimmer")) {
  const style = document.createElement("style");
  style.id = "ov-shimmer";
  style.textContent = `@keyframes shimmer { 100% { transform: translateX(100%); } }`;
  document.head.appendChild(style);
}
