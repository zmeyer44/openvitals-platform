import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./command";

interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  width?: string;
  disabled?: boolean;
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results.",
  size = "md",
  className,
  width = "240px",
  disabled
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          style={{ width }}
          className={cn(
            "flex items-center justify-between gap-2 cursor-pointer",
            "rounded-[7px] bg-surface text-ink border border-line shadow-xs",
            "transition-colors hover:border-line-strong",
            "focus:outline-none focus:border-accent/50",
            "disabled:cursor-not-allowed disabled:opacity-50",
            size === "sm" && "h-8 px-2.5 text-[13px]",
            size === "md" && "h-9 px-3 text-[13.5px]",
            size === "lg" && "h-10 px-3.5 text-[14px]",
            className
          )}
        >
          <span className={cn("truncate flex items-center gap-2", !selected && "text-subtle")}>
            {selected?.icon}
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-subtle" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0" style={{ width }} align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  {...(option.disabled !== undefined ? { disabled: option.disabled } : {})}
                  onSelect={() => {
                    onValueChange?.(option.value === value ? "" : option.value);
                    setOpen(false);
                  }}
                >
                  {option.icon}
                  <div className="flex flex-col flex-1 min-w-0 leading-tight">
                    <span className="truncate text-[13px] text-ink">{option.label}</span>
                    {option.description && (
                      <span className="truncate text-[11px] text-muted mt-0.5">
                        {option.description}
                      </span>
                    )}
                  </div>
                  <Check
                    className={cn(
                      "ml-auto size-3.5 stroke-[2.5] !text-accent shrink-0",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
