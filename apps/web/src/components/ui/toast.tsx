import * as React from "react";
import { Toaster as Sonner, toast as sonnerToast, type ToasterProps } from "sonner";
import { CheckCircle2, AlertTriangle, XCircle, Info, Loader2 } from "lucide-react";

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="bottom-right"
      visibleToasts={4}
      offset={16}
      gap={8}
      duration={4000}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "group pointer-events-auto relative flex w-[360px] gap-2.5 p-3 rounded-[10px] bg-surface text-ink border border-line shadow-pop text-[13px]",
          title: "font-medium text-ink leading-snug",
          description: "text-[12.5px] text-muted leading-snug mt-0.5",
          actionButton:
            "ml-auto inline-flex items-center justify-center h-7 px-2.5 rounded-[5px] bg-ink text-canvas text-[12px] font-medium hover:opacity-90 transition-opacity cursor-pointer",
          cancelButton:
            "inline-flex items-center justify-center h-7 px-2.5 rounded-[5px] bg-surface-strong text-ink-2 text-[12px] font-medium hover:bg-line transition-colors cursor-pointer",
          closeButton:
            "absolute -top-2 -right-2 size-5 rounded-full bg-ink text-canvas flex items-center justify-center"
        }
      }}
      icons={{
        success: <CheckCircle2 className="size-[18px] text-success shrink-0 mt-px" />,
        error: <XCircle className="size-[18px] text-danger shrink-0 mt-px" />,
        warning: <AlertTriangle className="size-[18px] text-warning shrink-0 mt-px" />,
        info: <Info className="size-[18px] text-info shrink-0 mt-px" />,
        loading: <Loader2 className="size-[18px] text-muted shrink-0 mt-px animate-spin" />
      }}
      {...props}
    />
  );
}

export const toast = sonnerToast;
