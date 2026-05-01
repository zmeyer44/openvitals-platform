import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { cn } from "../../lib/cn";

export const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Root ref={ref} className={cn("grid gap-2", className)} {...props} />
));
RadioGroup.displayName = "RadioGroup";

export const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    className={cn(
      "aspect-square size-[16px] rounded-full border border-line bg-surface shadow-xs cursor-pointer",
      "transition-colors",
      "hover:border-line-strong",
      "data-[state=checked]:border-accent data-[state=checked]:bg-accent",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    <RadioGroupPrimitive.Indicator className="flex items-center justify-center after:size-[6px] after:rounded-full after:bg-white after:content-['']" />
  </RadioGroupPrimitive.Item>
));
RadioGroupItem.displayName = "RadioGroupItem";

export function RadioCard({
  children,
  selected,
  className,
  ...props
}: React.HTMLAttributes<HTMLLabelElement> & { selected?: boolean }) {
  return (
    <label
      className={cn(
        "relative flex items-start gap-3 p-3 rounded-[8px] border bg-surface cursor-pointer",
        "transition-colors",
        selected
          ? "border-accent ring-1 ring-accent/20 bg-accent-soft/40"
          : "border-line hover:border-line-strong",
        className
      )}
      {...props}
    >
      {children}
    </label>
  );
}
