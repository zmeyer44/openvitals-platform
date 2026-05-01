import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "../../lib/cn";

type TabsVariant = "underline" | "pill" | "segmented";

const TabsVariantContext = React.createContext<TabsVariant>("underline");

export const Tabs = TabsPrimitive.Root;

interface TabsListProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
  variant?: TabsVariant;
}

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  TabsListProps
>(({ className, variant = "underline", children, ...props }, ref) => (
  <TabsVariantContext.Provider value={variant}>
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        "inline-flex items-center text-muted",
        variant === "underline" && "gap-0.5 border-b border-line h-9 -mb-px w-full",
        variant === "pill" && "gap-1 p-1 bg-surface-muted border border-line rounded-[8px] h-9",
        variant === "segmented" &&
          "gap-0 p-0.5 bg-surface-muted border border-line rounded-[7px] h-8",
        className
      )}
      {...props}
    >
      {children}
    </TabsPrimitive.List>
  </TabsVariantContext.Provider>
));
TabsList.displayName = "TabsList";

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => {
  const variant = React.useContext(TabsVariantContext);
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-[13px] font-medium cursor-pointer",
        "transition-all duration-150 disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:size-3.5 [&_svg]:shrink-0",
        variant === "underline" && [
          "relative h-9 px-3",
          "after:absolute after:inset-x-3 after:bottom-[-1px] after:h-[1.5px] after:bg-transparent after:transition-colors",
          "hover:text-ink",
          "data-[state=active]:text-ink data-[state=active]:after:bg-ink"
        ],
        variant === "pill" && [
          "h-7 px-3 rounded-[6px] hover:text-ink",
          "data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-sm"
        ],
        variant === "segmented" && [
          "h-7 px-3 rounded-[5px] flex-1 hover:text-ink",
          "data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-sm"
        ],
        className
      )}
      {...props}
    />
  );
});
TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "focus-visible:outline-none mt-3 animate-in fade-in-0 duration-150",
      className
    )}
    {...props}
  />
));
TabsContent.displayName = "TabsContent";
