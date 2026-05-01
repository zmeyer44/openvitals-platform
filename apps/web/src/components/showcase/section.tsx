import * as React from "react";
import { cn } from "../../lib/cn";

interface SectionProps {
  id: string;
  number: string;
  title: string;
  eyebrow?: string;
  description?: string;
  children: React.ReactNode;
}

export function Section({ id, number, title, eyebrow, description, children }: SectionProps) {
  return (
    <section id={id} className="scroll-mt-20 pt-14 first:pt-0">
      <div className="border-t border-line/0 first:border-t-0">
        <div className="mb-6 flex items-baseline gap-4">
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-subtle pt-1">
            {number}
          </span>
          <div className="flex-1 min-w-0">
            {eyebrow && (
              <span className="block text-[10.5px] uppercase tracking-[0.1em] text-accent font-semibold mb-1.5">
                {eyebrow}
              </span>
            )}
            <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-ink leading-[1.15]">
              {title}
            </h2>
            {description && (
              <p className="mt-2 text-[13.5px] text-muted leading-relaxed max-w-prose">
                {description}
              </p>
            )}
          </div>
        </div>
        <div className="space-y-6">{children}</div>
      </div>
    </section>
  );
}

interface ExampleProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
  density?: "default" | "compact" | "spacious";
  surface?: "default" | "muted" | "bare";
  align?: "start" | "center";
  className?: string;
}

export function Example({
  label,
  hint,
  children,
  density = "default",
  surface = "default",
  align = "start",
  className
}: ExampleProps) {
  return (
    <div className={cn("group", className)}>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-[10.5px] uppercase tracking-[0.08em] font-semibold text-muted">
          {label}
        </span>
        {hint && (
          <span className="text-[11.5px] text-subtle font-mono">— {hint}</span>
        )}
      </div>
      <div
        className={cn(
          "relative rounded-[10px] border border-line",
          surface === "default" && "bg-surface",
          surface === "muted" && "bg-surface-muted",
          surface === "bare" && "bg-transparent border-dashed",
          density === "compact" && "p-4",
          density === "default" && "p-6",
          density === "spacious" && "p-10",
          align === "start" && "flex flex-wrap items-center gap-3",
          align === "center" && "flex flex-wrap items-center justify-center gap-3"
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function Stack({
  children,
  className,
  gap = 3
}: {
  children: React.ReactNode;
  className?: string;
  gap?: 2 | 3 | 4 | 6 | 8;
}) {
  const gapClass = `gap-${gap}`;
  return (
    <div className={cn("flex flex-wrap items-center", gapClass, className)}>
      {children}
    </div>
  );
}

export function Row({
  label,
  children,
  className
}: {
  label?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-4 py-1", className)}>
      {label && (
        <div className="w-24 shrink-0 text-[11.5px] uppercase tracking-[0.06em] font-medium text-muted">
          {label}
        </div>
      )}
      <div className="flex-1 flex flex-wrap items-center gap-2.5">{children}</div>
    </div>
  );
}
