"use client";

import type React from "react";
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  memo,
  type KeyboardEvent
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Maximize,
  Minus,
  Plus,
  RotateCcw,
  PanelLeft,
  Expand
} from "lucide-react";
import * as pdfjs from "pdfjs-dist";
import { cn } from "../lib/cn";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "./ui/tooltip";

if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

interface PDFViewerProps {
  url: string;
  className?: string;
  onLoadSuccess?: (numPages: number) => void;
  onLoadError?: (error: Error) => void;
  onPageChange?: (page: number) => void;
  initialPage?: number;
  showThumbnails?: boolean;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.1;
const THUMBNAIL_WIDTH = 120;
const PAGE_GAP = 16;

function ToolbarButton({
  icon,
  tooltip,
  onClick,
  disabled,
  active
}: {
  icon: React.ReactNode;
  tooltip: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onClick}
          disabled={disabled}
          className={cn(active && "bg-surface-strong text-ink")}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

const PDFPage = memo(function PDFPage({
  page,
  pageNumber,
  scale,
  containerWidth,
  isVisible
}: {
  page: pdfjs.PDFPageProxy;
  pageNumber: number;
  scale: number;
  containerWidth: number;
  isVisible: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<pdfjs.RenderTask | null>(null);
  const isRenderingRef = useRef(false);
  const [hasRendered, setHasRendered] = useState(false);

  const viewport = useMemo(() => {
    const baseViewport = page.getViewport({ scale: 1 });
    if (containerWidth <= 48) {
      return page.getViewport({ scale });
    }
    const fitScale = (containerWidth - 48) / baseViewport.width;
    return page.getViewport({ scale: scale * Math.min(fitScale, 1) });
  }, [page, scale, containerWidth]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isVisible || isRenderingRef.current) return;

    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    const context = canvas.getContext("2d");
    if (!context) return;

    const outputScale = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    context.scale(outputScale, outputScale);
    isRenderingRef.current = true;

    const renderTask = page.render({ canvas, viewport });
    renderTaskRef.current = renderTask;

    renderTask.promise
      .then(() => {
        isRenderingRef.current = false;
        setHasRendered(true);
      })
      .catch((error) => {
        if (error.name !== "RenderingCancelledException") {
          isRenderingRef.current = false;
        }
      });

    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
        isRenderingRef.current = false;
      }
    };
  }, [page, viewport, isVisible]);

  return (
    <div
      className="pdf-page relative flex items-center justify-center"
      data-page={pageNumber}
      style={{ minHeight: viewport.height, minWidth: viewport.width }}
    >
      <div className="relative overflow-hidden rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.04)]">
        <canvas
          ref={canvasRef}
          className={cn(
            "block bg-white transition-opacity duration-200",
            hasRendered ? "opacity-100" : "opacity-0"
          )}
        />
        {!hasRendered && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-white"
            style={{ width: viewport.width, height: viewport.height }}
          >
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="size-5 animate-spin text-muted" />
              <span className="text-xs text-muted">Loading page {pageNumber}…</span>
            </div>
          </div>
        )}
      </div>

      <div
        className={cn(
          "absolute bottom-3 left-1/2 -translate-x-1/2",
          "rounded-full px-2 py-0.5",
          "bg-ink/80 text-canvas text-xs font-medium tabular-nums",
          "opacity-0 transition-opacity duration-200",
          "group-hover/pages:opacity-100"
        )}
      >
        {pageNumber}
      </div>
    </div>
  );
});

const PDFThumbnail = memo(function PDFThumbnail({
  page,
  pageNumber,
  isActive,
  onClick
}: {
  page: pdfjs.PDFPageProxy;
  pageNumber: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasRendered, setHasRendered] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const viewport = page.getViewport({ scale: 1 });
    const scale = THUMBNAIL_WIDTH / viewport.width;
    const scaledViewport = page.getViewport({ scale });

    const outputScale = window.devicePixelRatio || 1;
    canvas.width = Math.floor(scaledViewport.width * outputScale);
    canvas.height = Math.floor(scaledViewport.height * outputScale);
    canvas.style.width = `${scaledViewport.width}px`;
    canvas.style.height = `${scaledViewport.height}px`;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.scale(outputScale, outputScale);

    page
      .render({ canvas, viewport: scaledViewport })
      .promise.then(() => setHasRendered(true))
      .catch(() => {});
  }, [page]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center gap-1.5 rounded-lg p-1.5 transition-all duration-150",
        "hover:bg-surface-strong/60",
        isActive && "bg-surface-strong"
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded transition-all duration-150",
          "ring-2 ring-offset-2 ring-offset-surface",
          isActive
            ? "shadow-md ring-accent"
            : "ring-transparent hover:ring-line-strong"
        )}
      >
        <canvas
          ref={canvasRef}
          className={cn(
            "block bg-white transition-opacity duration-200",
            hasRendered ? "opacity-100" : "opacity-0"
          )}
        />
        {!hasRendered && (
          <Skeleton
            className="absolute inset-0"
            style={{
              width: THUMBNAIL_WIDTH,
              height: THUMBNAIL_WIDTH * Math.SQRT2
            }}
          />
        )}
      </div>
      <span
        className={cn(
          "text-xs tabular-nums transition-colors",
          isActive ? "font-medium text-ink" : "text-muted"
        )}
      >
        {pageNumber}
      </span>
    </button>
  );
});

function PDFToolbar({
  currentPage,
  totalPages,
  scale,
  showThumbnails,
  onPageChange,
  onScaleChange,
  onToggleThumbnails,
  onFitWidth,
  onFitPage,
  isLoading
}: {
  currentPage: number;
  totalPages: number;
  scale: number;
  showThumbnails: boolean;
  onPageChange: (page: number) => void;
  onScaleChange: (scale: number) => void;
  onToggleThumbnails: () => void;
  onFitWidth: () => void;
  onFitPage: () => void;
  isLoading: boolean;
}) {
  const [pageInput, setPageInput] = useState(currentPage.toString());

  useEffect(() => {
    setPageInput(currentPage.toString());
  }, [currentPage]);

  const handlePageInputSubmit = (
    e: React.FormEvent | React.FocusEvent<HTMLInputElement>
  ) => {
    e.preventDefault();
    const page = Number.parseInt(pageInput, 10);
    if (!Number.isNaN(page) && page >= 1 && page <= totalPages) {
      onPageChange(page);
    } else {
      setPageInput(currentPage.toString());
    }
  };

  const zoomPercentage = Math.round(scale * 100);

  return (
    <div
      className={cn(
        "flex items-center justify-between px-3 py-1.5",
        "border-b border-line bg-surface/95 backdrop-blur-sm",
        "supports-[backdrop-filter]:bg-surface/80",
        "z-10 shrink-0"
      )}
    >
      <div className="flex items-center">
        <ToolbarButton
          icon={<PanelLeft className="size-4" />}
          tooltip={showThumbnails ? "Hide pages" : "Show pages"}
          onClick={onToggleThumbnails}
          active={showThumbnails}
        />
      </div>

      <div className="flex items-center gap-1">
        <ToolbarButton
          icon={<ChevronLeft className="size-4" />}
          tooltip="Previous page"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1 || isLoading}
        />

        <form
          onSubmit={handlePageInputSubmit}
          className="flex items-center gap-1.5"
        >
          <input
            type="text"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onBlur={handlePageInputSubmit}
            className={cn(
              "h-7 w-10 rounded-md text-center text-sm tabular-nums",
              "border border-line bg-surface text-ink",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
              "transition-shadow"
            )}
            disabled={isLoading}
          />
          <span className="text-sm text-muted">/</span>
          <span className="min-w-[2ch] text-sm tabular-nums text-muted">
            {totalPages}
          </span>
        </form>

        <ToolbarButton
          icon={<ChevronRight className="size-4" />}
          tooltip="Next page"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages || isLoading}
        />
      </div>

      <div className="flex items-center gap-1">
        <ToolbarButton
          icon={<Minus className="size-4" />}
          tooltip="Zoom out"
          onClick={() => onScaleChange(Math.max(MIN_SCALE, scale - SCALE_STEP))}
          disabled={scale <= MIN_SCALE || isLoading}
        />

        <div
          className={cn(
            "flex items-center justify-center",
            "h-7 min-w-[52px] px-2",
            "text-sm tabular-nums text-muted",
            "rounded-md bg-surface-strong/60"
          )}
        >
          {zoomPercentage}%
        </div>

        <ToolbarButton
          icon={<Plus className="size-4" />}
          tooltip="Zoom in"
          onClick={() => onScaleChange(Math.min(MAX_SCALE, scale + SCALE_STEP))}
          disabled={scale >= MAX_SCALE || isLoading}
        />

        <div className="mx-1 h-5 w-px bg-line" />

        <ToolbarButton
          icon={<Maximize className="size-4" />}
          tooltip="Fit to width"
          onClick={onFitWidth}
          disabled={isLoading}
        />

        <ToolbarButton
          icon={<Expand className="size-4" />}
          tooltip="Fit to page"
          onClick={onFitPage}
          disabled={isLoading}
        />
      </div>
    </div>
  );
}

export function PDFViewer({
  url,
  className,
  onLoadSuccess,
  onLoadError,
  onPageChange: onPageChangeProp,
  initialPage = 1,
  showThumbnails: initialShowThumbnails = true
}: PDFViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<pdfjs.PDFPageProxy[]>([]);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [scale, setScale] = useState(1);
  const [showThumbnails, setShowThumbnails] = useState(initialShowThumbnails);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set([1]));

  useEffect(() => {
    let cancelled = false;

    async function loadPDF() {
      setIsLoading(true);
      setError(null);

      try {
        const loadingTask = pdfjs.getDocument({ url, withCredentials: true });
        const doc = await loadingTask.promise;
        if (cancelled) {
          doc.destroy();
          return;
        }

        const pagePromises: Promise<pdfjs.PDFPageProxy>[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          pagePromises.push(doc.getPage(i));
        }

        const loadedPages = await Promise.all(pagePromises);
        if (cancelled) return;

        setPages(loadedPages);
        setIsLoading(false);
        onLoadSuccess?.(doc.numPages);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Failed to load PDF";
        setError(msg);
        setIsLoading(false);
        onLoadError?.(err instanceof Error ? err : new Error(msg));
      }
    }

    void loadPDF();
    return () => {
      cancelled = true;
    };
  }, [url, onLoadSuccess, onLoadError]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer || pages.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        setVisiblePages((prev) => {
          const next = new Set(prev);
          for (const entry of entries) {
            const pageNum = Number.parseInt(
              (entry.target as HTMLElement).dataset.page || "0",
              10
            );
            if (entry.isIntersecting) {
              next.add(pageNum);
            }
          }
          return next;
        });

        const visibleEntries = entries.filter((e) => e.isIntersecting);
        if (visibleEntries.length > 0) {
          const mostVisible = visibleEntries.reduce((prev, curr) =>
            curr.intersectionRatio > prev.intersectionRatio ? curr : prev
          );
          const pageNum = Number.parseInt(
            (mostVisible.target as HTMLElement).dataset.page || "0",
            10
          );
          if (pageNum > 0) {
            setCurrentPage((cp) => {
              if (pageNum !== cp) onPageChangeProp?.(pageNum);
              return pageNum;
            });
          }
        }
      },
      {
        root: scrollContainer,
        rootMargin: "50px 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1]
      }
    );

    const pageElements =
      scrollContainer.querySelectorAll<HTMLElement>(".pdf-page");
    for (const el of pageElements) {
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, [pages, onPageChangeProp]);

  const scrollToPage = useCallback((pageNumber: number) => {
    const el = scrollContainerRef.current?.querySelector(
      `[data-page="${pageNumber}"]`
    );
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handlePageChange = useCallback(
    (page: number) => {
      if (page >= 1 && page <= pages.length) {
        setCurrentPage(page);
        scrollToPage(page);
        onPageChangeProp?.(page);
      }
    },
    [pages.length, scrollToPage, onPageChangeProp]
  );

  useEffect(() => {
    if (pages.length === 0 || !containerWidth) return;
    const firstPage = pages[0];
    if (!firstPage) return;
    const viewport = firstPage.getViewport({ scale: 1 });
    const fitScale = (containerWidth - 48) / viewport.width;
    if (fitScale < 1) setScale(fitScale);
  }, [pages, containerWidth]);

  const handleScaleChange = useCallback((s: number) => {
    setScale(Math.max(MIN_SCALE, Math.min(MAX_SCALE, s)));
  }, []);

  const handleFitWidth = useCallback(() => {
    if (pages.length === 0 || !containerWidth) return;
    const firstPage = pages[0];
    if (!firstPage) return;
    const vp = firstPage.getViewport({ scale: 1 });
    setScale((containerWidth - 48) / vp.width);
  }, [pages, containerWidth]);

  const handleFitPage = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || pages.length === 0) return;
    const firstPage = pages[0];
    if (!firstPage) return;

    const vp = firstPage.getViewport({ scale: 1 });
    const containerHeight = container.clientHeight - PAGE_GAP * 2;
    const widthScale = (containerWidth - 48) / vp.width;
    const heightScale = containerHeight / vp.height;
    setScale(Math.min(widthScale, heightScale));
  }, [pages, containerWidth]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (isLoading) return;
      switch (e.key) {
        case "ArrowLeft":
        case "ArrowUp":
          if (e.ctrlKey || e.metaKey) handlePageChange(1);
          else handlePageChange(currentPage - 1);
          e.preventDefault();
          break;
        case "ArrowRight":
        case "ArrowDown":
          if (e.ctrlKey || e.metaKey) handlePageChange(pages.length);
          else handlePageChange(currentPage + 1);
          e.preventDefault();
          break;
        case "Home":
          handlePageChange(1);
          e.preventDefault();
          break;
        case "End":
          handlePageChange(pages.length);
          e.preventDefault();
          break;
        case "+":
        case "=":
          if (e.ctrlKey || e.metaKey) {
            handleScaleChange(scale + SCALE_STEP);
            e.preventDefault();
          }
          break;
        case "-":
          if (e.ctrlKey || e.metaKey) {
            handleScaleChange(scale - SCALE_STEP);
            e.preventDefault();
          }
          break;
        case "0":
          if (e.ctrlKey || e.metaKey) {
            setScale(1);
            e.preventDefault();
          }
          break;
      }
    },
    [
      isLoading,
      currentPage,
      pages.length,
      scale,
      handlePageChange,
      handleScaleChange
    ]
  );

  if (isLoading && pages.length === 0) {
    return (
      <TooltipProvider delayDuration={200}>
        <div
          className={cn(
            "flex h-full flex-col overflow-hidden rounded-lg",
            "border border-line bg-surface-muted",
            className
          )}
        >
          <div className="flex items-center justify-between border-b border-line bg-surface px-3 py-1.5">
            <Skeleton className="h-7 w-7 rounded-md" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-md" />
              <Skeleton className="h-7 w-20 rounded-md" />
              <Skeleton className="h-7 w-7 rounded-md" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-md" />
              <Skeleton className="h-7 w-14 rounded-md" />
              <Skeleton className="h-7 w-7 rounded-md" />
            </div>
          </div>
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="size-8 animate-spin text-muted" />
              <p className="text-sm text-muted">Loading document…</p>
            </div>
          </div>
        </div>
      </TooltipProvider>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          "flex h-full flex-col overflow-hidden rounded-lg",
          "border border-line bg-surface-muted",
          className
        )}
      >
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="flex max-w-sm flex-col items-center gap-3 text-center">
            <div className="rounded-full bg-danger-soft p-3">
              <RotateCcw className="size-6 text-danger" />
            </div>
            <div>
              <p className="font-medium text-ink">Failed to load document</p>
              <p className="mt-1 text-sm text-muted">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div
        ref={containerRef}
        className={cn(
          "flex h-full flex-col overflow-hidden rounded-lg",
          "border border-line bg-surface-muted",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className
        )}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="document"
        aria-label="PDF Document Viewer"
      >
        <PDFToolbar
          currentPage={currentPage}
          totalPages={pages.length}
          scale={scale}
          showThumbnails={showThumbnails}
          onPageChange={handlePageChange}
          onScaleChange={handleScaleChange}
          onToggleThumbnails={() => setShowThumbnails(!showThumbnails)}
          onFitWidth={handleFitWidth}
          onFitPage={handleFitPage}
          isLoading={isLoading}
        />

        <div className="flex min-h-0 flex-1">
          {showThumbnails && (
            <div
              className={cn(
                "w-40 border-r border-line bg-surface/50",
                "flex flex-col overflow-hidden",
                "transition-all duration-200"
              )}
            >
              <div className="border-b border-line p-2">
                <span className="text-xs font-medium uppercase tracking-wider text-muted">
                  Pages
                </span>
              </div>
              <div className="flex-1 space-y-1 overflow-y-auto p-2">
                {pages.map((page, i) => (
                  <PDFThumbnail
                    key={i + 1}
                    page={page}
                    pageNumber={i + 1}
                    isActive={currentPage === i + 1}
                    onClick={() => handlePageChange(i + 1)}
                  />
                ))}
              </div>
            </div>
          )}

          <div
            ref={scrollContainerRef}
            className="relative flex-1 overflow-auto bg-surface-strong/40"
          >
            <div className="group/pages flex min-h-full flex-col items-center gap-4 py-4">
              {pages.map((page, i) => {
                const pageNumber = i + 1;
                return (
                  <PDFPage
                    key={pageNumber}
                    page={page}
                    pageNumber={pageNumber}
                    scale={scale}
                    containerWidth={containerWidth}
                    isVisible={
                      visiblePages.has(pageNumber) ||
                      Math.abs(currentPage - pageNumber) <= 2
                    }
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
