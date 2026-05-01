import * as React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "../../lib/cn";

interface StatProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  delta?: { value: number; label?: string; tone?: "auto" | "positive" | "negative" };
  trailing?: React.ReactNode;
  helper?: React.ReactNode;
  display?: "default" | "editorial";
}

export function Stat({
  label,
  value,
  unit,
  delta,
  trailing,
  helper,
  display = "default",
  className,
  ...props
}: StatProps) {
  const tone =
    delta?.tone === "auto" || !delta?.tone
      ? delta && delta.value >= 0
        ? "positive"
        : "negative"
      : delta.tone;
  const isPositive = tone === "positive";

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 p-4 bg-surface rounded-[10px] border border-line",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] font-medium uppercase tracking-[0.05em] text-muted">
          {label}
        </span>
        {trailing}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span
          className={cn(
            "text-ink leading-none tabular-nums",
            display === "editorial"
              ? "text-[36px] font-light tracking-[-0.035em]"
              : "text-[28px] font-semibold tracking-[-0.025em]"
          )}
        >
          {value}
        </span>
        {unit && (
          <span className="text-[13px] text-muted font-medium tabular-nums">
            {unit}
          </span>
        )}
        {delta && (
          <span
            className={cn(
              "ml-1 inline-flex items-center gap-0.5 text-[12px] font-semibold tabular-nums",
              isPositive ? "text-success" : "text-danger"
            )}
          >
            {isPositive ? (
              <ArrowUpRight className="size-3 stroke-[2.5]" />
            ) : (
              <ArrowDownRight className="size-3 stroke-[2.5]" />
            )}
            {Math.abs(delta.value)}%{delta.label && <span className="text-muted font-normal ml-0.5">{delta.label}</span>}
          </span>
        )}
      </div>
      {helper && <div className="text-[12px] text-muted leading-snug">{helper}</div>}
    </div>
  );
}
