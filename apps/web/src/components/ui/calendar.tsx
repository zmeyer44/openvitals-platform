import * as React from "react";
import { DayPicker } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/cn";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/*
 * react-day-picker v9 doesn't add literal modifier names as DOM classes — it
 * just concatenates the strings from `classNames` for each active modifier.
 * That means the `selected` modifier's text-white rule lands on every range
 * cell (start, middle, end) and competes with our overrides via cascade
 * order.
 *
 * To get reliable specificity we add internal "marker" classes (`ov-rs`,
 * `ov-re`, `ov-rm`) to each range modifier, then make `selected` opt out
 * with `:not()` when any of them are present. The middle days then keep
 * their dark-on-soft-blue contrast.
 */

export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 select-none", className)}
      classNames={{
        root: "text-ink",
        months: "flex flex-col sm:flex-row gap-4",
        month: "space-y-3",
        month_caption: "flex justify-center pt-1 relative items-center h-8",
        caption_label: "text-[13px] font-semibold text-ink tracking-[-0.01em]",
        nav: "flex items-center gap-1 absolute inset-x-0 top-0 justify-between px-1 py-1",
        button_previous:
          "size-7 rounded-[6px] inline-flex items-center justify-center text-muted hover:text-ink hover:bg-surface-strong transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer",
        button_next:
          "size-7 rounded-[6px] inline-flex items-center justify-center text-muted hover:text-ink hover:bg-surface-strong transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer",
        chevron: "size-4",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "text-subtle w-8 font-medium text-[10.5px] uppercase tracking-[0.06em] py-1",
        weeks: "flex flex-col mt-1",
        week: "flex w-full",
        day: cn(
          "relative size-8 text-center text-[13px]",
          "focus-within:relative focus-within:z-20"
        ),
        day_button: cn(
          "size-8 inline-flex items-center justify-center rounded-[6px] tabular-nums",
          "text-ink-2 transition-colors cursor-pointer relative z-10 w-full h-full",
          "hover:bg-surface-strong hover:text-ink",
          "disabled:opacity-40 disabled:pointer-events-none"
        ),
        // Plain selected (mode=single, or a range endpoint without context):
        // only paint the button when no range marker is on the cell.
        selected: cn(
          "[&:not(.ov-rs):not(.ov-re):not(.ov-rm)>button]:!bg-accent",
          "[&:not(.ov-rs):not(.ov-re):not(.ov-rm)>button]:!text-white",
          "[&:not(.ov-rs):not(.ov-re):not(.ov-rm)>button]:hover:!bg-accent-hover"
        ),
        range_start: cn(
          "ov-rs bg-accent-soft rounded-l-[6px]",
          "[&>button]:!bg-accent [&>button]:!text-white [&>button]:hover:!bg-accent-hover",
          "last:rounded-r-[6px]"
        ),
        range_end: cn(
          "ov-re bg-accent-soft rounded-r-[6px]",
          "[&>button]:!bg-accent [&>button]:!text-white [&>button]:hover:!bg-accent-hover",
          "first:rounded-l-[6px]"
        ),
        range_middle: cn(
          "ov-rm bg-accent-soft",
          "[&>button]:!bg-transparent [&>button]:!text-ink [&>button]:!rounded-none",
          "[&>button]:hover:!bg-accent/15",
          "first:rounded-l-[6px]",
          "last:rounded-r-[6px]"
        ),
        today: "[&>button]:ring-1 [&>button]:ring-line-strong",
        outside:
          "[&:not(.ov-rs):not(.ov-re):not(.ov-rm)>button]:text-faint",
        disabled: "opacity-40",
        hidden: "invisible",
        ...classNames
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />
      }}
      {...props}
    />
  );
}
