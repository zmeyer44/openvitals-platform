import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "../../lib/cn";

interface SwitchProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> {
  size?: "sm" | "md";
}

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  SwitchProps
>(({ className, size = "md", ...props }, ref) => {
  const dimensions =
    size === "sm"
      ? "h-[18px] w-[30px] [&_[data-thumb]]:size-[14px] data-[state=checked]:[&_[data-thumb]]:translate-x-[12px]"
      : "h-[22px] w-[38px] [&_[data-thumb]]:size-[18px] data-[state=checked]:[&_[data-thumb]]:translate-x-[16px]";

  return (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        "peer inline-flex shrink-0 items-center rounded-full border border-line shadow-inner transition-colors cursor-pointer",
        "data-[state=unchecked]:bg-surface-strong data-[state=checked]:bg-accent data-[state=checked]:border-accent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        dimensions,
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-thumb
        className={cn(
          "pointer-events-none block translate-x-[2px] rounded-full bg-white shadow-[0_1px_2px_0_rgb(15_14_12/0.18),0_0_0_0.5px_rgb(15_14_12/0.06)]",
          "transition-transform duration-200 ease-out"
        )}
      />
    </SwitchPrimitive.Root>
  );
});
Switch.displayName = "Switch";
