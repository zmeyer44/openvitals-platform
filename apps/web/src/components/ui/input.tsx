import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

const inputVariants = cva(
  [
    "flex w-full bg-surface text-ink placeholder:text-subtle",
    "border border-line shadow-xs rounded-[7px]",
    "transition-colors",
    "focus-visible:outline-none focus-visible:border-accent",
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-muted",
    "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ink",
    "selection:bg-accent-soft selection:text-accent-soft-foreground"
  ].join(" "),
  {
    variants: {
      size: {
        sm: "h-8 px-2.5 text-[13px]",
        md: "h-9 px-3 text-[13.5px]",
        lg: "h-10 px-3.5 text-[14px]"
      },
      invalid: {
        true: "border-danger/60 focus-visible:border-danger"
      }
    },
    defaultVariants: { size: "md" }
  }
);

type InputBaseProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> &
  VariantProps<typeof inputVariants>;

interface InputProps extends InputBaseProps {
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  trailingAddon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, size, invalid, leadingIcon, trailingIcon, trailingAddon, ...props }, ref) => {
    if (leadingIcon || trailingIcon || trailingAddon) {
      return (
        <div
          className={cn(
            "group relative flex items-center w-full",
            "rounded-[7px] border border-line bg-surface shadow-xs",
            "focus-within:border-accent",
            invalid && "border-danger/60 focus-within:border-danger",
            size === "sm" && "h-8",
            (!size || size === "md") && "h-9",
            size === "lg" && "h-10",
            props.disabled && "opacity-50 bg-surface-muted",
            className
          )}
        >
          {leadingIcon && (
            <span className="pl-2.5 pr-1.5 text-subtle [&_svg]:size-4 [&_svg]:shrink-0">
              {leadingIcon}
            </span>
          )}
          <input
            ref={ref}
            className={cn(
              "flex-1 min-w-0 bg-transparent text-ink placeholder:text-subtle",
              "focus-visible:outline-none disabled:cursor-not-allowed",
              "selection:bg-accent-soft selection:text-accent-soft-foreground",
              size === "sm" && "h-8 text-[13px]",
              (!size || size === "md") && "h-9 text-[13.5px]",
              size === "lg" && "h-10 text-[14px]",
              !leadingIcon && "pl-3",
              !trailingIcon && !trailingAddon && "pr-3"
            )}
            {...props}
          />
          {trailingIcon && (
            <span className="pl-1.5 pr-2.5 text-subtle [&_svg]:size-4 [&_svg]:shrink-0">
              {trailingIcon}
            </span>
          )}
          {trailingAddon && (
            <div className="border-l border-line h-full flex items-center px-2.5 text-muted text-[12.5px] bg-surface-muted rounded-r-[6px]">
              {trailingAddon}
            </div>
          )}
        </div>
      );
    }
    return (
      <input ref={ref} className={cn(inputVariants({ size, invalid }), className)} {...props} />
    );
  }
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(({ className, invalid, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex w-full min-h-20 bg-surface text-ink placeholder:text-subtle",
      "border border-line shadow-xs rounded-[7px] px-3 py-2 text-[13.5px]",
      "transition-colors resize-y",
      "focus-visible:outline-none focus-visible:border-accent",
      "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-muted",
      "selection:bg-accent-soft selection:text-accent-soft-foreground",
      invalid && "border-danger/60 focus-visible:border-danger",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
