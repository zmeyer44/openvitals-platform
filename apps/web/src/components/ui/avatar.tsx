import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

const avatarVariants = cva(
  "relative inline-flex shrink-0 overflow-hidden bg-surface-strong border border-line/40",
  {
    variants: {
      size: {
        xs: "size-5 rounded-[4px] text-[9px]",
        sm: "size-6 rounded-[5px] text-[10px]",
        md: "size-8 rounded-[6px] text-[11.5px]",
        lg: "size-10 rounded-[8px] text-[13px]",
        xl: "size-12 rounded-[9px] text-[15px]",
        "2xl": "size-16 rounded-[10px] text-[18px]"
      },
      shape: {
        square: "",
        circle: "!rounded-full"
      }
    },
    defaultVariants: { size: "md", shape: "square" }
  }
);

interface AvatarProps
  extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>,
    VariantProps<typeof avatarVariants> {}

export const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  AvatarProps
>(({ className, size, shape, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(avatarVariants({ size, shape }), className)}
    {...props}
  />
));
Avatar.displayName = "Avatar";

export const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full object-cover", className)}
    {...props}
  />
));
AvatarImage.displayName = "AvatarImage";

export const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center bg-surface-strong text-ink-2 font-medium uppercase tracking-tight",
      className
    )}
    {...props}
  />
));
AvatarFallback.displayName = "AvatarFallback";

export function AvatarStack({
  children,
  className,
  max
}: {
  children: React.ReactNode;
  max?: number;
  className?: string;
}) {
  const items = React.Children.toArray(children);
  const visible = max ? items.slice(0, max) : items;
  const overflow = max && items.length > max ? items.length - max : 0;
  return (
    <div className={cn("inline-flex items-center -space-x-1.5", className)}>
      {visible.map((child, i) => (
        <div
          key={i}
          className="ring-2 ring-surface rounded-[6px]"
          style={{ zIndex: visible.length - i }}
        >
          {child}
        </div>
      ))}
      {overflow > 0 && (
        <div
          className={cn(
            "size-8 rounded-[6px] bg-surface-muted text-ink-2 text-[11px] font-medium",
            "ring-2 ring-surface inline-flex items-center justify-center"
          )}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
