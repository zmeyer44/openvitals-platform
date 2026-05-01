import * as React from "react";
import { cn } from "../../lib/cn";

export function BrandMark({
  className,
  size = 24
}: {
  className?: string;
  size?: number;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-[6px]",
        "bg-ink text-canvas relative overflow-hidden shrink-0",
        className
      )}
      style={{ width: size, height: size }}
    >
      {/* EKG-style pulse glyph */}
      <svg
        width={size * 0.7}
        height={size * 0.7}
        viewBox="0 0 14 14"
        fill="none"
        aria-hidden
      >
        <path
          d="M0.5 7H3.5L4.5 4L6 10L7.5 5.5L9 8.5L10.5 7H13.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className="absolute right-[3px] top-[3px] size-1 rounded-full bg-accent"
        aria-hidden
      />
    </span>
  );
}

export function BrandLockup({ className }: { className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <BrandMark size={22} />
      <span className="text-[14.5px] font-semibold tracking-[-0.015em] text-ink">
        OpenVitals
      </span>
      <span className="text-[10.5px] font-mono text-subtle px-1.5 py-0.5 rounded-[4px] bg-surface-strong border border-line/40">
        v1.24
      </span>
    </div>
  );
}
