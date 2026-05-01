import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/cn";

export const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2 select-none whitespace-nowrap font-medium cursor-pointer",
    "transition-[background,color,border-color,box-shadow,transform] duration-150",
    "active:scale-[0.985] disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed",
    "[&_svg]:size-[1.05em] [&_svg]:shrink-0 [&_svg]:-mx-0.5"
  ].join(" "),
  {
    variants: {
      variant: {
        primary: [
          "bg-accent text-accent-foreground border border-transparent",
          "shadow-[inset_0_1px_0_0_rgb(255_255_255/0.18),0_1px_2px_0_rgb(15_14_12/0.12),0_0_0_1px_rgb(15_14_12/0.04)]",
          "hover:bg-accent-hover",
          "active:bg-accent-pressed active:shadow-[inset_0_1px_0_0_rgb(255_255_255/0.18),0_1px_1px_0_rgb(15_14_12/0.16)]"
        ].join(" "),
        secondary: [
          "bg-surface text-ink border border-line",
          "shadow-xs",
          "hover:bg-surface-muted hover:border-line-strong",
          "active:bg-surface-strong"
        ].join(" "),
        outline: [
          "bg-transparent text-ink border border-line-strong",
          "hover:bg-surface-muted hover:border-line-strong",
          "active:bg-surface-strong"
        ].join(" "),
        ghost: [
          "bg-transparent text-ink-2 border border-transparent",
          "hover:bg-surface-strong hover:text-ink",
          "active:bg-line"
        ].join(" "),
        soft: [
          "bg-surface-strong text-ink border border-transparent",
          "hover:bg-line",
          "active:bg-line-strong"
        ].join(" "),
        destructive: [
          "bg-danger text-white border border-transparent",
          "shadow-[inset_0_1px_0_0_rgb(255_255_255/0.18),0_1px_2px_0_rgb(15_14_12/0.12)]",
          "hover:opacity-90 active:opacity-80"
        ].join(" "),
        link: [
          "bg-transparent text-accent underline-offset-4 px-0",
          "hover:underline active:opacity-80"
        ].join(" ")
      },
      size: {
        xs: "h-7 px-2.5 text-[12.5px] rounded-[6px] gap-1.5",
        sm: "h-8 px-3 text-[13px] rounded-[6px]",
        md: "h-9 px-3.5 text-[13.5px] rounded-[7px]",
        lg: "h-10 px-4 text-[14px] rounded-[8px]",
        xl: "h-11 px-5 text-[15px] rounded-[9px]",
        "icon-xs": "size-7 rounded-[6px] [&_svg]:size-3.5",
        "icon-sm": "size-8 rounded-[6px] [&_svg]:size-4",
        icon: "size-9 rounded-[7px] [&_svg]:size-4",
        "icon-lg": "size-10 rounded-[8px] [&_svg]:size-[18px]"
      }
    },
    defaultVariants: {
      variant: "secondary",
      size: "md"
    }
  }
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
    leadingIcon?: React.ReactNode;
    trailingIcon?: React.ReactNode;
    shortcut?: string;
  };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading,
      leadingIcon,
      trailingIcon,
      shortcut,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    const isIconOnly = size?.toString().startsWith("icon");
    const showLoading = loading && !isIconOnly;

    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {showLoading ? <Loader2 className="animate-spin" /> : leadingIcon}
        {loading && isIconOnly ? <Loader2 className="animate-spin" /> : children}
        {!loading && trailingIcon}
        {shortcut && !isIconOnly && (
          <span className="ml-1 -mr-1 hidden text-[11px] font-medium text-current/60 tabular-nums sm:inline-flex">
            {shortcut}
          </span>
        )}
      </Comp>
    );
  }
);
Button.displayName = "Button";

/* ----- Button Group ----- */

export const ButtonGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    role="group"
    className={cn(
      "inline-flex isolate",
      "[&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:-ml-px",
      "[&>*:not(:last-child)]:rounded-r-none",
      "[&>*:hover]:z-10 [&>*:focus-visible]:z-20",
      className
    )}
    {...props}
  />
));
ButtonGroup.displayName = "ButtonGroup";
