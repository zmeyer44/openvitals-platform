import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  AlertCircle,
  Archive,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  Bell,
  Bookmark,
  Bot,
  Building2,
  Check,
  ChevronRight,
  ChevronsUpDown,
  Circle,
  Clock,
  Cloud,
  Command,
  Copy,
  Database,
  Dot,
  Download,
  Edit,
  Eye,
  EyeOff,
  FileJson,
  FilePlus,
  Filter,
  Flag,
  Github,
  Heart,
  HeartPulse,
  Inbox,
  Info,
  Layers,
  LayoutGrid,
  Link2,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageSquare,
  MoreHorizontal,
  MoveDown,
  MoveUp,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  Play,
  Plug,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Settings2,
  Share2,
  ShieldCheck,
  Slack,
  Sparkles,
  Star,
  Sun,
  Moon,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  User,
  Users
} from "lucide-react";

import type { DateRange } from "react-day-picker";

import { cn } from "../lib/cn";
import { Button, ButtonGroup } from "../components/ui/button";
import { Input, Textarea } from "../components/ui/input";
import { Label, FieldHint } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { Avatar, AvatarFallback, AvatarStack } from "../components/ui/avatar";
import { Switch } from "../components/ui/switch";
import { Checkbox } from "../components/ui/checkbox";
import { RadioGroup, RadioGroupItem, RadioCard } from "../components/ui/radio-group";
import { Slider } from "../components/ui/slider";
import { Progress } from "../components/ui/progress";
import { Skeleton } from "../components/ui/skeleton";
import { Kbd, KbdGroup } from "../components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipSimple,
  TooltipTrigger
} from "../components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "../components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger
} from "../components/ui/hover-card";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "../components/ui/dialog";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "../components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from "../components/ui/select";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut
} from "../components/ui/command";
import { Combobox } from "../components/ui/combobox";
import { Calendar } from "../components/ui/calendar";
import {
  SortableHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "../components/ui/table";
import { Toaster, toast } from "../components/ui/toast";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "../components/ui/breadcrumb";
import { Stat } from "../components/ui/stat";
import { EmptyState } from "../components/ui/empty-state";
import {
  AreaTrend,
  BarTrend,
  DonutChart,
  LineTrend,
  Sparkline,
  StackedArea
} from "../components/ui/chart";
import { Section, Example, Row } from "../components/showcase/section";
import { BrandLockup, BrandMark } from "../components/showcase/brand";
import {
  benchmarkSeries,
  changelog,
  cohortSeries,
  heartRateSeries,
  integrations,
  sourceMix,
  sourceOptions,
  teamMembers,
  vitals,
  type IntegrationStatus
} from "../components/showcase/data";

export const Route = createFileRoute("/components")({
  component: ComponentsPage
});

/* ----------------------------------------------------------------------------
   Page navigation config
   --------------------------------------------------------------------------*/

const navSections = [
  {
    label: "Foundations",
    items: [
      { id: "overview", label: "Overview" },
      { id: "color", label: "Color" },
      { id: "type", label: "Typography" }
    ]
  },
  {
    label: "Controls",
    items: [
      { id: "buttons", label: "Buttons" },
      { id: "inputs", label: "Inputs & forms" },
      { id: "selection", label: "Selection" },
      { id: "switches", label: "Switches & sliders" }
    ]
  },
  {
    label: "Display",
    items: [
      { id: "badges", label: "Badges & tags" },
      { id: "avatars", label: "Avatars" },
      { id: "stats", label: "Stat cards" },
      { id: "infocards", label: "Info cards" },
      { id: "feedback", label: "Progress & loaders" },
      { id: "kbd", label: "Keyboard hints" }
    ]
  },
  {
    label: "Feedback",
    items: [
      { id: "alerts", label: "Alerts" },
      { id: "toasts", label: "Toasts" },
      { id: "empty", label: "Empty states" }
    ]
  },
  {
    label: "Overlays",
    items: [
      { id: "tooltips", label: "Tooltips" },
      { id: "hovercards", label: "Hover cards" },
      { id: "dropdowns", label: "Dropdown menus" },
      { id: "popovers", label: "Popovers" },
      { id: "modals", label: "Modals" },
      { id: "drawers", label: "Drawers" },
      { id: "command", label: "Command palette" }
    ]
  },
  {
    label: "Navigation",
    items: [
      { id: "tabs", label: "Tabs" },
      { id: "breadcrumb", label: "Breadcrumb" }
    ]
  },
  {
    label: "Data",
    items: [
      { id: "tables", label: "Tables" },
      { id: "calendar", label: "Calendar" },
      { id: "charts", label: "Charts" }
    ]
  }
];

/* ----------------------------------------------------------------------------
   Page
   --------------------------------------------------------------------------*/

const workspaces = [
  { id: "ov-prod", name: "OpenVitals", env: "Production" },
  { id: "ov-staging", name: "OpenVitals — Staging", env: "Staging" },
  { id: "ov-research", name: "Research Partners", env: "Read-only" }
];

function ComponentsPage() {
  const [activeId, setActiveId] = React.useState("overview");
  const [theme, setTheme] = React.useState<"light" | "dark">("light");
  const [cmdOpen, setCmdOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const [activeWorkspace, setActiveWorkspace] = React.useState(workspaces[0]!);

  React.useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", theme === "dark");
    }
  }, [theme]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
      if (e.key === "[" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCollapsed((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting);
        if (visible?.target.id) setActiveId(visible.target.id);
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    document.querySelectorAll("section[id]").forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  const toggleBtn = (
    <button
      type="button"
      onClick={() => setCollapsed((v) => !v)}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      className={cn(
        "relative inline-flex size-8 shrink-0 items-center justify-center rounded-[6px] cursor-pointer",
        "text-muted transition-colors hover:bg-surface-strong hover:text-ink"
      )}
    >
      <div className="relative grid size-4 place-items-center">
        <PanelLeftClose
          className={cn("absolute size-4 transition-all", collapsed ? "scale-0" : "scale-100")}
        />
        <PanelLeftOpen
          className={cn("absolute size-4 transition-all", collapsed ? "scale-100" : "scale-0")}
        />
      </div>
    </button>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-screen w-screen overflow-hidden bg-canvas text-ink">
        {/* Sidebar — sits on the canvas with no border; the main panel is the card */}
        <aside
          className={cn(
            "flex h-full shrink-0 flex-col justify-between overflow-hidden px-2 pb-2 pt-2",
            "transition-[width] duration-300 ease-in-out",
            collapsed ? "w-[56px]" : "w-[244px]"
          )}
        >
          {/* Top */}
          <div className="flex flex-1 flex-col gap-3 overflow-hidden">
            {/* Brand row + collapse toggle */}
            <div
              className={cn(
                "flex h-10 items-center gap-2",
                collapsed ? "justify-center" : "px-1"
              )}
            >
              {!collapsed ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "group flex min-w-0 flex-1 items-center gap-2 rounded-[7px] p-1 -ml-1 outline-none cursor-pointer",
                        "transition-colors hover:bg-surface-strong"
                      )}
                    >
                      <BrandMark size={28} />
                      <div className="flex min-w-0 flex-1 flex-col text-left">
                        <span className="truncate text-[13px] font-medium leading-tight text-ink">
                          {activeWorkspace.name}
                        </span>
                        <span className="truncate text-[10.5px] uppercase tracking-[0.08em] text-muted leading-tight mt-0.5">
                          {activeWorkspace.env} · v1.24
                        </span>
                      </div>
                      <ChevronsUpDown className="size-3.5 shrink-0 text-subtle" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={6} className="w-60">
                    <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
                    {workspaces.map((ws) => (
                      <DropdownMenuItem
                        key={ws.id}
                        onSelect={() => setActiveWorkspace(ws)}
                        className="py-1.5"
                      >
                        <BrandMark size={20} />
                        <div className="flex flex-col min-w-0 flex-1 leading-tight">
                          <span className="truncate text-[13px] text-ink">{ws.name}</span>
                          <span className="truncate text-[11px] text-muted mt-0.5">
                            {ws.env}
                          </span>
                        </div>
                        {activeWorkspace.id === ws.id && (
                          <Check className="ml-auto !text-accent size-3.5 stroke-[2.5] shrink-0" />
                        )}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <Plus />
                      Create workspace
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Settings />
                      Workspace settings
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <BrandMark size={28} />
              )}
              {!collapsed && toggleBtn}
            </div>

            {/* Collapsed state: toggle below the brand mark */}
            {collapsed && <div className="flex justify-center">{toggleBtn}</div>}

            {/* Quick search */}
            {!collapsed ? (
              <button
                type="button"
                onClick={() => setCmdOpen(true)}
                className={cn(
                  "flex w-full items-center gap-2 h-8 px-2 rounded-[7px] cursor-pointer",
                  "text-muted text-[12.5px]",
                  "hover:bg-surface-strong hover:text-ink-2 transition-colors"
                )}
              >
                <Search className="size-3.5" />
                <span className="flex-1 text-left">Quick search</span>
                <KbdGroup keys={["⌘", "K"]} />
              </button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setCmdOpen(true)}
                    className={cn(
                      "size-8 mx-auto inline-flex items-center justify-center rounded-[6px] cursor-pointer",
                      "text-muted hover:bg-surface-strong hover:text-ink transition-colors"
                    )}
                  >
                    <Search className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  Quick search · ⌘ K
                </TooltipContent>
              </Tooltip>
            )}

            {/* Nav sections */}
            <nav className="flex flex-col gap-3 overflow-y-auto -mx-2 px-2">
              {navSections.map((group) => (
                <SidebarSection key={group.label} label={group.label} collapsed={collapsed}>
                  {group.items.map((item) => (
                    <SidebarNavItem
                      key={item.id}
                      href={`#${item.id}`}
                      label={item.label}
                      isActive={activeId === item.id}
                      collapsed={collapsed}
                    />
                  ))}
                </SidebarSection>
              ))}
            </nav>
          </div>

          {/* Bottom: user menu */}
          <SidebarUserMenu
            collapsed={collapsed}
            theme={theme}
            onThemeToggle={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
          />
        </aside>

        {/* Main panel — card-like, sits on the canvas */}
        <div className="flex flex-1 p-2 pl-0 min-w-0">
          <main className="relative flex-1 overflow-auto rounded-[10px] border border-line bg-surface shadow-sm">
            <header
              className={cn(
                "sticky top-0 z-20 h-14 border-b border-line rounded-t-[10px]",
                "bg-surface/95 backdrop-blur-md flex items-center px-6"
              )}
            >
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="#">Platform</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink href="#">Design system</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Components</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <div className="ml-auto flex items-center gap-2">
                <TooltipSimple content="Documentation" shortcut="?">
                  <Button variant="ghost" size="icon-sm">
                    <Info />
                  </Button>
                </TooltipSimple>
                <TooltipSimple content="Notifications">
                  <Button variant="ghost" size="icon-sm">
                    <Bell />
                  </Button>
                </TooltipSimple>
                <Separator orientation="vertical" className="h-5 mx-1" />
                <Button
                  variant="secondary"
                  size="sm"
                  leadingIcon={<Github />}
                  trailingIcon={<ArrowUpRight className="opacity-50" />}
                >
                  View source
                </Button>
                <Button variant="primary" size="sm" leadingIcon={<Plus />}>
                  New record
                </Button>
              </div>
            </header>

            <div className="px-10 py-12 max-w-[1100px] mx-auto">
              <PageHero />

              <div className="mt-16 space-y-2">
                <FoundationsOverview />
                <ColorSection />
                <TypographySection />
                <ButtonsSection />
                <InputsSection />
                <SelectionSection />
                <SwitchesSection />
                <BadgesSection />
                <AvatarsSection />
                <StatsSection />
                <InfoCardsSection />
                <FeedbackSection />
                <KbdSection />
                <AlertsSection />
                <ToastsSection />
                <EmptyStateSection />
                <TooltipSection />
                <HoverCardSection />
                <DropdownMenuSection />
                <PopoverSection />
                <ModalsSection />
                <DrawerSection />
                <CommandSection cmdOpen={cmdOpen} onOpenChange={setCmdOpen} />
                <TabsSection />
                <BreadcrumbSection />
                <TablesSection />
                <CalendarSection />
                <ChartsSection />
              </div>

              <PageFooter />
            </div>
          </main>
        </div>

        <Toaster />
      </div>
    </TooltipProvider>
  );
}

/* ----------------------------------------------------------------------------
   Sidebar helpers
   --------------------------------------------------------------------------*/

function SidebarSection({
  label,
  collapsed,
  children
}: {
  label: string;
  collapsed: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-full flex-col gap-0.5">
      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          collapsed ? "h-0" : "h-5"
        )}
      >
        <div className="flex h-5 items-center px-2 text-[10.5px] uppercase tracking-[0.08em] font-semibold text-subtle">
          {label}
        </div>
      </div>
      <div className="flex flex-col gap-px">{children}</div>
    </div>
  );
}

function SidebarNavItem({
  href,
  label,
  isActive,
  collapsed
}: {
  href: string;
  label: string;
  isActive: boolean;
  collapsed: boolean;
}) {
  const classes = cn(
    "group/nav relative flex h-8 w-full items-center rounded-[6px] text-[13px] transition-colors cursor-pointer",
    isActive
      ? "bg-surface-strong text-ink"
      : "text-muted hover:bg-surface-strong/60 hover:text-ink",
    collapsed ? "justify-center px-0" : "gap-2.5 px-2"
  );
  const content = (
    <a href={href} className={classes}>
      <span
        className={cn(
          "size-1.5 rounded-full shrink-0 transition-colors",
          isActive ? "bg-accent" : "bg-faint group-hover/nav:bg-muted"
        )}
      />
      {!collapsed && <span className="truncate">{label}</span>}
      {isActive && !collapsed && (
        <span className="ml-auto h-4 w-[2px] rounded-full bg-accent" />
      )}
    </a>
  );
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }
  return content;
}

function SidebarUserMenu({
  collapsed,
  theme,
  onThemeToggle
}: {
  collapsed: boolean;
  theme: "light" | "dark";
  onThemeToggle: () => void;
}) {
  const trigger = (
    <PopoverTrigger asChild>
      <button
        type="button"
        className={cn(
          "flex min-w-0 w-full items-center gap-2 rounded-[7px] outline-none cursor-pointer",
          "transition-colors hover:bg-surface-strong",
          collapsed ? "size-8 mx-auto justify-center p-0" : "p-1.5"
        )}
      >
        <Avatar size="sm">
          <AvatarFallback style={{ background: "#1a6ff4", color: "white" }}>
            EW
          </AvatarFallback>
        </Avatar>
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-[12.5px] font-medium text-ink truncate leading-tight">
                Eli Williams
              </div>
              <div className="text-[11px] text-muted truncate leading-tight mt-0.5">
                eli@openvitals.io
              </div>
            </div>
            <MoreHorizontal className="size-4 shrink-0 text-muted" />
          </>
        )}
      </button>
    </PopoverTrigger>
  );

  return (
    <div className="pt-2">
      <Popover>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>{trigger}</TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Eli Williams
            </TooltipContent>
          </Tooltip>
        ) : (
          trigger
        )}
        <PopoverContent
          side={collapsed ? "right" : "top"}
          align="start"
          sideOffset={8}
          className="w-64 p-0"
        >
          <div className="flex items-center gap-3 p-3">
            <Avatar size="md">
              <AvatarFallback style={{ background: "#1a6ff4", color: "white" }}>
                EW
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-ink leading-tight">
                Eli Williams
              </p>
              <p className="truncate text-[11.5px] text-muted leading-tight mt-0.5">
                eli@openvitals.io
              </p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between px-3 py-2.5">
            <span className="text-[12px] text-ink-2">Theme</span>
            <div className="inline-flex items-center gap-0.5 p-0.5 rounded-[6px] bg-surface-muted border border-line">
              <button
                type="button"
                onClick={() => theme === "dark" && onThemeToggle()}
                className={cn(
                  "inline-flex items-center justify-center size-6 rounded-[4px] cursor-pointer transition-colors",
                  theme === "light" ? "bg-surface text-ink shadow-xs" : "text-muted hover:text-ink"
                )}
                aria-label="Light theme"
              >
                <Sun className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => theme === "light" && onThemeToggle()}
                className={cn(
                  "inline-flex items-center justify-center size-6 rounded-[4px] cursor-pointer transition-colors",
                  theme === "dark" ? "bg-surface text-ink shadow-xs" : "text-muted hover:text-ink"
                )}
                aria-label="Dark theme"
              >
                <Moon className="size-3.5" />
              </button>
            </div>
          </div>
          <Separator />
          <div className="p-1">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-[5px] px-2 py-1.5 text-left text-[13px] text-ink-2 transition-colors hover:bg-surface-strong cursor-pointer"
            >
              <User className="size-3.5 text-muted" />
              Account
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-[5px] px-2 py-1.5 text-left text-[13px] text-ink-2 transition-colors hover:bg-surface-strong cursor-pointer"
            >
              <Settings className="size-3.5 text-muted" />
              Workspace settings
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-[5px] px-2 py-1.5 text-left text-[13px] text-ink-2 transition-colors hover:bg-surface-strong cursor-pointer"
            >
              <LogOut className="size-3.5 text-muted" />
              Sign out
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   Hero & Footer
   --------------------------------------------------------------------------*/

function PageHero() {
  return (
    <div className="relative">
      <div className="flex items-baseline gap-3 mb-4">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent">
          Design System · v1.24
        </span>
        <span className="h-px flex-1 bg-line" />
        <span className="font-mono text-[11px] text-muted">{new Date().toISOString().slice(0, 10)}</span>
      </div>
      <h1 className="text-[44px] font-semibold tracking-[-0.025em] text-ink leading-[1.05] max-w-3xl">
        A practical kit of components for{" "}
        <span className="text-accent">vital</span>{" "}
        clinical interfaces.
      </h1>
      <p className="mt-4 text-[15px] text-muted leading-relaxed max-w-2xl">
        These primitives compose every surface of the OpenVitals platform — from
        record review and provenance audits to integration management. They are tuned for dense,
        information-rich workflows that practitioners use every day.
      </p>

      <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-px overflow-hidden rounded-[10px] border border-line bg-line">
        {[
          { label: "Primitives", value: "32", helper: "shadcn-derived" },
          { label: "Tokens", value: "84", helper: "color · type · radius" },
          { label: "Charts", value: "6", helper: "recharts wrappers" },
          { label: "Themes", value: "2", helper: "light & dark" }
        ].map((s) => (
          <div key={s.label} className="bg-surface px-4 py-3.5">
            <div className="text-[10.5px] uppercase tracking-[0.08em] font-medium text-muted">
              {s.label}
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-[26px] font-light tracking-[-0.03em] leading-none text-ink tabular-nums">
                {s.value}
              </span>
              <span className="text-[11px] text-muted">{s.helper}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PageFooter() {
  return (
    <footer className="mt-24 pt-8 border-t border-line flex items-center justify-between text-[12px] text-muted">
      <div className="flex items-center gap-3">
        <BrandMark size={20} />
        <span>OpenVitals · Components reference</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="font-mono">{new Date().getFullYear()}</span>
        <a className="hover:text-ink transition-colors" href="#overview">
          Back to top ↑
        </a>
      </div>
    </footer>
  );
}

/* ----------------------------------------------------------------------------
   Foundations
   --------------------------------------------------------------------------*/

function FoundationsOverview() {
  return (
    <Section
      id="overview"
      number="01"
      eyebrow="Foundations"
      title="Refined Operator"
      description="Vercel-clean, Ramp-confident — tuned for the density of clinical data work. A warm-neutral canvas, a single vermillion accent, and typography that respects the work you're doing."
    >
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            icon: <Activity className="size-4 text-accent" />,
            title: "Vital, not loud",
            body: "A single vermillion accent earns attention by being scarce. Status uses dedicated tones — not the brand."
          },
          {
            icon: <Layers className="size-4 text-info" />,
            title: "Density on demand",
            body: "Tables, sidebars, and dashboards prioritize information. Whitespace is earned, not given."
          },
          {
            icon: <ShieldCheck className="size-4 text-success" />,
            title: "Provenance-aware",
            body: "Components surface lineage — who, when, from what source — without crowding the work."
          }
        ].map((c) => (
          <div
            key={c.title}
            className="p-4 rounded-[10px] border border-line bg-surface flex flex-col gap-2"
          >
            <div className="size-8 rounded-[7px] bg-surface-muted border border-line flex items-center justify-center">
              {c.icon}
            </div>
            <div className="text-[13.5px] font-semibold text-ink tracking-[-0.005em]">
              {c.title}
            </div>
            <div className="text-[12.5px] text-muted leading-relaxed">{c.body}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function ColorSection() {
  const tokenSwatches = [
    { name: "canvas", hex: "F8F8F7" },
    { name: "surface", hex: "FFFFFF" },
    { name: "surface-muted", hex: "FBFAF8" },
    { name: "surface-strong", hex: "F2F1ED" },
    { name: "line", hex: "EAE9E5" },
    { name: "line-strong", hex: "D5D3CD" }
  ];

  const inkScale = [
    { name: "ink", hex: "151210" },
    { name: "ink-2", hex: "3A3631" },
    { name: "muted", hex: "70695E" },
    { name: "subtle", hex: "9D968A" },
    { name: "faint", hex: "C8C2B7" }
  ];

  const status = [
    { name: "accent", hex: "DC3D2A", soft: "#FCEDEA" },
    { name: "success", hex: "20835A", soft: "#E5F4EC" },
    { name: "warning", hex: "B65A12", soft: "#FCEFD8" },
    { name: "danger", hex: "C0291F", soft: "#FBE8E5" },
    { name: "info", hex: "295DA8", soft: "#E5EDF8" }
  ];

  return (
    <Section
      id="color"
      number="02"
      eyebrow="Foundations"
      title="Color"
      description="A warm neutral system anchored by a vermillion accent. Status colors are reserved for state — never decoration."
    >
      <Example label="Surfaces & lines" density="compact">
        <div className="grid grid-cols-6 gap-2 w-full">
          {tokenSwatches.map((s) => (
            <SwatchTile key={s.name} {...s} />
          ))}
        </div>
      </Example>

      <Example label="Ink scale" density="compact">
        <div className="grid grid-cols-5 gap-2 w-full">
          {inkScale.map((s) => (
            <SwatchTile key={s.name} {...s} dark />
          ))}
        </div>
      </Example>

      <Example label="Status" density="compact">
        <div className="grid grid-cols-5 gap-2 w-full">
          {status.map((s) => (
            <div key={s.name} className="flex flex-col gap-1.5">
              <div
                className="h-12 rounded-[6px] border border-line/40 flex items-end p-2"
                style={{ background: `#${s.hex}` }}
              >
                <span className="font-mono text-[10.5px] text-white tabular-nums">
                  #{s.hex}
                </span>
              </div>
              <div
                className="h-6 rounded-[4px] border border-line/40 px-2 flex items-center"
                style={{ background: s.soft }}
              >
                <span className="font-mono text-[10px] tabular-nums" style={{ color: `#${s.hex}` }}>
                  soft
                </span>
              </div>
              <div className="text-[11px] font-medium text-muted">{s.name}</div>
            </div>
          ))}
        </div>
      </Example>
    </Section>
  );
}

function SwatchTile({
  name,
  hex,
  dark
}: {
  name: string;
  hex: string;
  dark?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="h-16 rounded-[6px] border border-line/40 flex items-end p-2"
        style={{ background: `#${hex}` }}
      >
        <span
          className={cn(
            "font-mono text-[10.5px] tabular-nums",
            dark ? "text-white/80" : "text-ink/60"
          )}
        >
          #{hex}
        </span>
      </div>
      <div className="text-[11px] font-medium text-muted">{name}</div>
    </div>
  );
}

function TypographySection() {
  return (
    <Section
      id="type"
      number="03"
      eyebrow="Foundations"
      title="Typography"
      description="Geist runs the interface — Light at large display sizes, Semibold for headings, Regular and Medium across the rest. Geist Mono carries identifiers, timestamps, and code."
    >
      <Example label="Display & body" density="default">
        <div className="space-y-5 w-full">
          <div>
            <span className="text-[10px] font-mono text-subtle uppercase tracking-[0.08em]">
              Display 64 · Geist Light
            </span>
            <div className="text-[64px] font-light leading-none tracking-[-0.04em] text-ink tabular-nums">
              184,239
            </div>
          </div>
          <Separator />
          <div>
            <span className="text-[10px] font-mono text-subtle uppercase tracking-[0.08em]">
              H1 · Geist Semibold 38
            </span>
            <h1 className="text-[38px] font-semibold tracking-[-0.025em] text-ink leading-tight">
              Care doesn't wait for the merge.
            </h1>
          </div>
          <div>
            <span className="text-[10px] font-mono text-subtle uppercase tracking-[0.08em]">
              H2 · Geist Semibold 22
            </span>
            <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-ink leading-snug">
              Provenance for every fact, by default.
            </h2>
          </div>
          <div>
            <span className="text-[10px] font-mono text-subtle uppercase tracking-[0.08em]">
              Body · Geist 14
            </span>
            <p className="text-[14px] text-ink-2 leading-relaxed max-w-prose">
              The platform records lineage at write-time: which extraction span produced this fact,
              which reviewer signed it off, and which canonical record it merged into.
            </p>
          </div>
          <div>
            <span className="text-[10px] font-mono text-subtle uppercase tracking-[0.08em]">
              Mono · Geist Mono 12
            </span>
            <code className="block font-mono text-[12px] text-ink-2 bg-surface-muted px-3 py-2 rounded-[6px] border border-line">
              POST /api/imports — Idempotency-Key: import:0xa12c
            </code>
          </div>
        </div>
      </Example>
    </Section>
  );
}

/* ----------------------------------------------------------------------------
   Buttons
   --------------------------------------------------------------------------*/

function ButtonsSection() {
  const [loading, setLoading] = React.useState(false);
  return (
    <Section
      id="buttons"
      number="04"
      eyebrow="Controls"
      title="Buttons"
      description="Seven variants, five sizes, with leading or trailing icons, shortcuts, and loading states. The primary variant earns its weight; secondary handles the bulk of work."
    >
      <Example label="Variants">
        <Button variant="primary" leadingIcon={<Plus />}>
          Connect new
        </Button>
        <Button variant="secondary" leadingIcon={<Download />}>
          Export
        </Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost" leadingIcon={<Settings />}>
          Settings
        </Button>
        <Button variant="soft" leadingIcon={<Filter />}>
          Filter
        </Button>
        <Button variant="destructive" leadingIcon={<Trash2 />}>
          Delete
        </Button>
        <Button variant="link" trailingIcon={<ArrowUpRight />}>
          View docs
        </Button>
      </Example>

      <Example label="Sizes">
        <Button variant="primary" size="xs">
          xs
        </Button>
        <Button variant="primary" size="sm">
          sm
        </Button>
        <Button variant="primary" size="md">
          md
        </Button>
        <Button variant="primary" size="lg">
          lg
        </Button>
        <Button variant="primary" size="xl">
          xl
        </Button>
      </Example>

      <Example label="States">
        <Button variant="primary">Default</Button>
        <Button variant="primary" disabled>
          Disabled
        </Button>
        <Button
          variant="primary"
          loading={loading}
          onClick={() => {
            setLoading(true);
            setTimeout(() => setLoading(false), 1600);
          }}
        >
          {loading ? "Importing…" : "Click to load"}
        </Button>
        <Button variant="secondary" leadingIcon={<Check />}>
          Saved
        </Button>
      </Example>

      <Example label="With shortcut">
        <Button variant="primary" shortcut="⌘ S" leadingIcon={<Bookmark />}>
          Save record
        </Button>
        <Button variant="secondary" shortcut="⌘ ⏎" trailingIcon={<ArrowRight />}>
          Submit for review
        </Button>
      </Example>

      <Example label="Icon-only">
        <Button variant="primary" size="icon-sm">
          <Plus />
        </Button>
        <Button variant="secondary" size="icon-sm">
          <RefreshCw />
        </Button>
        <Button variant="ghost" size="icon-sm">
          <Settings />
        </Button>
        <Button variant="soft" size="icon-sm">
          <MoreHorizontal />
        </Button>
        <Button variant="primary" size="icon-lg">
          <Plus />
        </Button>
      </Example>

      <Example label="Button group">
        <ButtonGroup>
          <Button variant="secondary" size="sm" leadingIcon={<LayoutGrid />}>
            Grid
          </Button>
          <Button variant="secondary" size="sm" leadingIcon={<Menu />}>
            List
          </Button>
          <Button variant="secondary" size="sm" leadingIcon={<Filter />}>
            Filter
          </Button>
        </ButtonGroup>
        <ButtonGroup>
          <Button variant="primary" size="md">
            Approve
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="primary" size="icon">
                <ChevronRight className="rotate-90" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Approve & continue</DropdownMenuItem>
              <DropdownMenuItem>Approve with note</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Save as draft</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ButtonGroup>
      </Example>
    </Section>
  );
}

/* ----------------------------------------------------------------------------
   Inputs / Form elements
   --------------------------------------------------------------------------*/

function InputsSection() {
  return (
    <Section
      id="inputs"
      number="05"
      eyebrow="Controls"
      title="Inputs & forms"
      description="Form primitives that share a tight visual rhythm. Affordances — leading icons, trailing addons, validation states — fit into a single 36px row."
    >
      <Example label="Inputs" density="default" align="start">
        <div className="grid grid-cols-2 gap-4 w-full">
          <div className="space-y-1.5">
            <Label htmlFor="i-1">Patient ID</Label>
            <Input id="i-1" placeholder="PT-00000" />
            <FieldHint>Unique identifier issued by the platform</FieldHint>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="i-2">Search records</Label>
            <Input id="i-2" placeholder="Search by name or ID…" leadingIcon={<Search />} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="i-3" required>
              Provider domain
            </Label>
            <Input
              id="i-3"
              placeholder="hospital"
              trailingAddon={<span className="font-mono">.openvitals.io</span>}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="i-4">API key</Label>
            <Input
              id="i-4"
              type="password"
              defaultValue="sk_live_a8f3d2e9c"
              trailingIcon={<Eye />}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="i-5">Failed validation</Label>
            <Input
              id="i-5"
              defaultValue="invalid value"
              invalid
              leadingIcon={<AlertCircle />}
            />
            <p className="text-[11.5px] text-danger">Must be a valid FHIR identifier.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="i-6">Disabled</Label>
            <Input id="i-6" disabled defaultValue="Read-only" />
          </div>
        </div>
      </Example>

      <Example label="Textarea" density="default" align="start">
        <div className="w-full max-w-xl space-y-1.5">
          <Label htmlFor="t-1">Reviewer note</Label>
          <Textarea
            id="t-1"
            rows={4}
            placeholder="Document why this record was flagged for follow-up…"
            defaultValue="SpO₂ trending below threshold across the last three readings; recommending pulse-ox follow up before discharge."
          />
          <FieldHint>Notes are auditable and visible to the patient on request.</FieldHint>
        </div>
      </Example>

      <Example label="Sizes">
        <Input size="sm" placeholder="Small" />
        <Input size="md" placeholder="Medium" />
        <Input size="lg" placeholder="Large" />
      </Example>
    </Section>
  );
}

/* ----------------------------------------------------------------------------
   Selection: select, combobox, radio
   --------------------------------------------------------------------------*/

function SelectionSection() {
  const [source, setSource] = React.useState("epic");
  const [acuity, setAcuity] = React.useState("watch");
  return (
    <Section
      id="selection"
      number="06"
      eyebrow="Controls"
      title="Selection"
      description="Drop-downs for short fixed lists, combobox with search for long lists, radios for one-of-N when the choice should be visible at a glance."
    >
      <Example label="Select & combobox" density="default" align="start">
        <div className="grid grid-cols-2 gap-4 max-w-xl w-full">
          <div className="space-y-1.5">
            <Label>Source EHR</Label>
            <Select defaultValue="epic">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Hospital systems</SelectLabel>
                  <SelectItem value="epic">Epic Systems</SelectItem>
                  <SelectItem value="cerner">Oracle Health</SelectItem>
                  <SelectItem value="athena">Athenahealth</SelectItem>
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Wearables</SelectLabel>
                  <SelectItem value="apple">Apple Health</SelectItem>
                  <SelectItem value="fitbit">Fitbit</SelectItem>
                  <SelectItem value="dexcom">Dexcom</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Connector</Label>
            <Combobox
              options={sourceOptions}
              value={source}
              onValueChange={setSource}
              placeholder="Select connector…"
              width="100%"
            />
          </div>
        </div>
      </Example>

      <Example label="Radio group" density="default" align="start">
        <div className="w-full max-w-md">
          <RadioGroup defaultValue="watch" onValueChange={setAcuity} className="gap-2">
            {[
              {
                value: "normal",
                label: "Normal",
                desc: "Defer to scheduled review cadence."
              },
              {
                value: "watch",
                label: "Watch",
                desc: "Flag for clinician review within 24h."
              },
              {
                value: "critical",
                label: "Critical",
                desc: "Page on-call clinician immediately."
              }
            ].map((opt) => (
              <RadioCard key={opt.value} selected={acuity === opt.value}>
                <RadioGroupItem value={opt.value} className="mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-ink">
                      {opt.label}
                    </span>
                    {acuity === opt.value && (
                      <Badge variant="accent" size="sm" dot>
                        Selected
                      </Badge>
                    )}
                  </div>
                  <p className="text-[12px] text-muted mt-0.5">{opt.desc}</p>
                </div>
              </RadioCard>
            ))}
          </RadioGroup>
        </div>
      </Example>

      <Example label="Checkbox group">
        <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 max-w-md w-full">
          {[
            { id: "c1", label: "FHIR R4 bundles", checked: true },
            { id: "c2", label: "FHIR R5 bundles", checked: true },
            { id: "c3", label: "HL7 v2 ADT", checked: false },
            { id: "c4", label: "C-CDA documents", checked: true },
            { id: "c5", label: "Wearable streams", checked: false },
            { id: "c6", label: "Custom CSV imports", checked: false }
          ].map((c) => (
            <label
              key={c.id}
              className="flex items-center gap-2 text-[13px] text-ink-2 cursor-pointer"
            >
              <Checkbox defaultChecked={c.checked} id={c.id} />
              {c.label}
            </label>
          ))}
        </div>
      </Example>
    </Section>
  );
}

/* ----------------------------------------------------------------------------
   Switches & sliders
   --------------------------------------------------------------------------*/

function SwitchesSection() {
  return (
    <Section
      id="switches"
      number="07"
      eyebrow="Controls"
      title="Switches & sliders"
      description="Switches for binary settings; sliders for ranges. Both share the same accent treatment."
    >
      <Example label="Switches" density="default" align="start">
        <div className="space-y-3 w-full max-w-md">
          {[
            {
              id: "s-1",
              label: "Enable provenance graph",
              hint: "Trace every fact to a source span and reviewer.",
              defaultChecked: true
            },
            {
              id: "s-2",
              label: "Auto-merge confident facts",
              hint: "Skip review when the model is ≥ 0.95 confident.",
              defaultChecked: false
            },
            {
              id: "s-3",
              label: "Send weekly audit digest",
              hint: "Email the reviewer-activity summary every Monday.",
              defaultChecked: true
            }
          ].map((opt) => (
            <div
              key={opt.id}
              className="flex items-start justify-between gap-4 py-1.5"
            >
              <div className="flex-1">
                <Label htmlFor={opt.id} className="block">
                  {opt.label}
                </Label>
                <FieldHint className="mt-0.5">{opt.hint}</FieldHint>
              </div>
              <Switch id={opt.id} defaultChecked={opt.defaultChecked} />
            </div>
          ))}
        </div>
      </Example>

      <Example label="Sliders" density="default" align="start">
        <div className="space-y-6 w-full max-w-md">
          <div>
            <div className="flex items-baseline justify-between mb-2.5">
              <Label>Auto-merge threshold</Label>
              <span className="font-mono text-[12px] text-ink-2 tabular-nums">0.92</span>
            </div>
            <Slider defaultValue={[92]} max={100} step={1} />
          </div>
          <div>
            <div className="flex items-baseline justify-between mb-2.5">
              <Label>Reviewer SLA window</Label>
              <span className="font-mono text-[12px] text-ink-2 tabular-nums">
                12 — 48 h
              </span>
            </div>
            <Slider defaultValue={[12, 48]} max={72} step={1} />
          </div>
        </div>
      </Example>
    </Section>
  );
}

/* ----------------------------------------------------------------------------
   Badges
   --------------------------------------------------------------------------*/

function BadgesSection() {
  const statusMap: Record<IntegrationStatus, { variant: "success" | "info" | "warning" | "muted"; label: string }> = {
    connected: { variant: "success", label: "Connected" },
    syncing: { variant: "info", label: "Syncing" },
    issue: { variant: "warning", label: "Attention" },
    paused: { variant: "muted", label: "Paused" }
  };
  return (
    <Section
      id="badges"
      number="08"
      eyebrow="Display"
      title="Badges & tags"
      description="A vocabulary of small status indicators. Soft surfaces by default; outlined for low-density rows; solid for critical attention."
    >
      <Example label="Status">
        <Badge variant="success" dot>
          Connected
        </Badge>
        <Badge variant="info" dot>
          Syncing
        </Badge>
        <Badge variant="warning" dot>
          Attention
        </Badge>
        <Badge variant="danger" dot>
          Failed
        </Badge>
        <Badge variant="accent" dot>
          New
        </Badge>
        <Badge variant="muted" dot>
          Paused
        </Badge>
      </Example>

      <Example label="Variants">
        <Badge variant="neutral">Neutral</Badge>
        <Badge variant="muted">Muted</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge variant="success">+ 4.2%</Badge>
        <Badge variant="warning">QA pending</Badge>
        <Badge variant="danger">Schema drift</Badge>
        <Badge variant="info">v1.24</Badge>
        <Badge variant="accent">
          <Sparkles className="size-3" />
          AI-extracted
        </Badge>
        <Badge variant="solid">Internal</Badge>
      </Example>

      <Example label="Sizes">
        <Badge variant="success" size="sm" dot>
          sm
        </Badge>
        <Badge variant="success" size="md" dot>
          md
        </Badge>
        <Badge variant="success" size="lg" dot>
          lg
        </Badge>
      </Example>

      <Example label="In context — integrations" surface="muted">
        <div className="grid grid-cols-2 gap-2 w-full">
          {integrations.slice(0, 4).map((i) => {
            const status = statusMap[i.status];
            return (
              <div
                key={i.id}
                className="flex items-center justify-between gap-2 px-3 h-10 bg-surface rounded-[7px] border border-line"
              >
                <span className="text-[13px] font-medium text-ink truncate">
                  {i.name}
                </span>
                <Badge variant={status.variant} size="sm" dot>
                  {status.label}
                </Badge>
              </div>
            );
          })}
        </div>
      </Example>
    </Section>
  );
}

/* ----------------------------------------------------------------------------
   Avatars
   --------------------------------------------------------------------------*/

function AvatarsSection() {
  return (
    <Section
      id="avatars"
      number="09"
      eyebrow="Display"
      title="Avatars"
      description="Square by default — fitting clinical UI density — with a circular variant. Stacks summarize teams without crowding."
    >
      <Example label="Sizes">
        {(["xs", "sm", "md", "lg", "xl", "2xl"] as const).map((size) => (
          <Avatar key={size} size={size}>
            <AvatarFallback style={{ background: "#E5352B", color: "white" }}>
              EW
            </AvatarFallback>
          </Avatar>
        ))}
      </Example>

      <Example label="Square & circle">
        {teamMembers.slice(0, 6).map((m) => (
          <Avatar key={m.id} shape="square">
            <AvatarFallback style={{ background: m.color, color: "white" }}>
              {m.initials}
            </AvatarFallback>
          </Avatar>
        ))}
        <Separator orientation="vertical" className="h-8 mx-2" />
        {teamMembers.slice(0, 6).map((m) => (
          <Avatar key={m.id} shape="circle">
            <AvatarFallback style={{ background: m.color, color: "white" }}>
              {m.initials}
            </AvatarFallback>
          </Avatar>
        ))}
      </Example>

      <Example label="Stack">
        <AvatarStack max={5}>
          {teamMembers.map((m) => (
            <Avatar key={m.id} size="md">
              <AvatarFallback style={{ background: m.color, color: "white" }}>
                {m.initials}
              </AvatarFallback>
            </Avatar>
          ))}
        </AvatarStack>
        <span className="ml-3 text-[13px] text-muted">6 reviewers active</span>
      </Example>
    </Section>
  );
}

/* ----------------------------------------------------------------------------
   Stats
   --------------------------------------------------------------------------*/

function StatsSection() {
  return (
    <Section
      id="stats"
      number="10"
      eyebrow="Display"
      title="Stat cards"
      description="The atom of the dashboard. Two display modes — default for dense grids, editorial for hero moments where the numeral is the message."
    >
      <Example label="Editorial display" density="compact">
        <div className="grid grid-cols-3 gap-3 w-full">
          <Stat
            label="Records canonical"
            value="184,239"
            delta={{ value: 4.2, label: "30d" }}
            display="editorial"
            helper="Lineage-tracked since v1.23"
          />
          <Stat
            label="Avg review SLA"
            value="14"
            unit="h"
            delta={{ value: -1.4, tone: "positive", label: "vs last wk" }}
            display="editorial"
          />
          <Stat
            label="Reviewer agreement"
            value="0.94"
            delta={{ value: 0.6, label: "Cohen's κ" }}
            display="editorial"
          />
        </div>
      </Example>

      <Example label="Default display" density="compact">
        <div className="grid grid-cols-4 gap-3 w-full">
          <Stat
            label="Active integrations"
            value="6"
            delta={{ value: 1, tone: "positive", label: "added" }}
          />
          <Stat
            label="Pending review"
            value="42"
            trailing={<Badge variant="warning" size="sm">SLA</Badge>}
          />
          <Stat
            label="Failed jobs"
            value="3"
            delta={{ value: -50, tone: "positive" }}
          />
          <Stat
            label="Daily volume"
            value="11.4k"
            delta={{ value: 8.1 }}
          />
        </div>
      </Example>

      <Example label="With sparkline" density="compact">
        <div className="grid grid-cols-2 gap-3 w-full">
          <Stat
            label="Heart rate — Avery M."
            value="62"
            unit="bpm"
            display="editorial"
            trailing={
              <Sparkline data={vitals[1]?.trend ?? []} tone="positive" width={72} height={28} />
            }
            helper="Trending toward resting baseline (60 bpm)."
          />
          <Stat
            label="Glucose — Caleb N."
            value="164"
            unit="mg/dL"
            display="editorial"
            trailing={
              <Sparkline data={vitals[4]?.trend ?? []} tone="negative" width={72} height={28} />
            }
            helper="Above postprandial threshold; flag for review."
          />
        </div>
      </Example>
    </Section>
  );
}

/* ----------------------------------------------------------------------------
   Info cards
   --------------------------------------------------------------------------*/

function InfoCardsSection() {
  return (
    <Section
      id="infocards"
      number="11"
      eyebrow="Display"
      title="Info cards"
      description="Compositional cards — header, content, footer — for grouping work that belongs together."
    >
      <Example label="Integration card" density="compact">
        <div className="grid grid-cols-2 gap-3 w-full">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3 border-none pb-0">
              <div className="flex items-start gap-3">
                <div className="size-9 rounded-[8px] bg-ink text-canvas flex items-center justify-center">
                  <Github className="size-[18px]" />
                </div>
                <div className="flex-1">
                  <CardTitle>Epic — North Region</CardTitle>
                  <CardDescription className="mt-0.5">
                    Inbound bundles · FHIR R4 · 184k records
                  </CardDescription>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Settings />
                    Edit settings
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <FileJson />
                    View logs
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <RefreshCw />
                    Refresh connection
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destructive>
                    <Plug />
                    Disconnect
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent className="pt-3">
              <div className="grid grid-cols-3 gap-2 text-[12px]">
                <div>
                  <div className="text-muted">Last sync</div>
                  <div className="font-mono text-ink mt-0.5">2 min ago</div>
                </div>
                <div>
                  <div className="text-muted">Health</div>
                  <div className="text-ink mt-0.5 flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-success" />
                    Healthy
                  </div>
                </div>
                <div>
                  <div className="text-muted">Throughput</div>
                  <div className="font-mono text-ink mt-0.5">412 / hr</div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="justify-between">
              <Badge variant="success" dot>
                Connected
              </Badge>
              <Button variant="ghost" size="sm" trailingIcon={<ArrowRight />}>
                View
              </Button>
            </CardFooter>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="border-none pb-0">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] uppercase tracking-[0.08em] font-semibold text-muted">
                  Patient · Active
                </span>
                <Badge variant="warning" size="sm" dot>
                  Watch
                </Badge>
              </div>
              <CardTitle className="mt-2 text-[18px]">Avery Marsh</CardTitle>
              <CardDescription>PT-04812 · 47 yo F · last visit 2026-04-18</CardDescription>
            </CardHeader>
            <CardContent className="pt-3 space-y-2.5">
              {[
                { metric: "BP", value: "128/82", reference: "120/80 mmHg", flag: "watch" },
                { metric: "HR", value: "72", reference: "60–100 bpm", flag: "normal" },
                { metric: "SpO₂", value: "97", reference: "≥ 95 %", flag: "normal" }
              ].map((v) => (
                <div
                  key={v.metric}
                  className="flex items-baseline justify-between text-[13px]"
                >
                  <span className="text-muted w-12">{v.metric}</span>
                  <span className="flex-1 font-mono text-ink ml-2">{v.value}</span>
                  <span className="text-[11.5px] text-subtle font-mono">{v.reference}</span>
                </div>
              ))}
            </CardContent>
            <CardFooter>
              <Button variant="ghost" size="sm" leadingIcon={<HeartPulse />}>
                Open record
              </Button>
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={<MessageSquare />}
                className="ml-auto"
              >
                Add note
              </Button>
            </CardFooter>
          </Card>
        </div>
      </Example>

      <Example label="Changelog feed" density="compact">
        <div className="w-full divide-y divide-line border border-line bg-surface rounded-[10px] overflow-hidden">
          {changelog.map((c) => (
            <div key={c.id} className="p-4 flex items-start gap-4">
              <div className="w-[88px] shrink-0 pt-0.5">
                <div className="font-mono text-[12px] text-ink font-medium">
                  {c.version}
                </div>
                <div className="text-[11px] text-muted">{c.date}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-medium text-ink tracking-[-0.005em]">
                  {c.title}
                </div>
                <p className="mt-1 text-[12.5px] text-muted leading-relaxed">
                  {c.summary}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.tags.map((t) => (
                    <Badge key={t} variant="neutral" size="sm">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Example>
    </Section>
  );
}

/* ----------------------------------------------------------------------------
   Progress, skeleton, kbd
   --------------------------------------------------------------------------*/

function FeedbackSection() {
  return (
    <Section
      id="feedback"
      number="12"
      eyebrow="Display"
      title="Progress & loaders"
      description="A controlled vocabulary for in-flight work — determinate progress, skeletons for layout reservations."
    >
      <Example label="Progress" density="default" align="start">
        <div className="space-y-4 w-full max-w-md">
          {[
            { label: "Importing FHIR bundle — 3,402 records", value: 64, tone: "accent" as const },
            { label: "Reviewer assignment", value: 92, tone: "success" as const },
            { label: "Audit log compaction", value: 22, tone: "warning" as const }
          ].map((p) => (
            <div key={p.label}>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-[12.5px] text-ink-2">{p.label}</span>
                <span className="font-mono text-[11.5px] text-muted tabular-nums">
                  {p.value}%
                </span>
              </div>
              <Progress value={p.value} tone={p.tone} />
            </div>
          ))}
        </div>
      </Example>

      <Example label="Skeleton" density="default" align="start">
        <div className="space-y-3 w-full max-w-md">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-[8px]" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
            <Skeleton className="h-6 w-16" />
          </div>
          <Skeleton className="h-32 w-full" />
        </div>
      </Example>
    </Section>
  );
}

function KbdSection() {
  return (
    <Section
      id="kbd"
      number="13"
      eyebrow="Display"
      title="Keyboard hints"
      description="Inline keys for shortcuts — paired with menus, actions, or placed in tooltips."
    >
      <Example label="Single & combination">
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
        <KbdGroup keys={["⌘", "K"]} />
        <KbdGroup keys={["⌘", "Shift", "P"]} />
        <KbdGroup keys={["G", "I"]} />
      </Example>
    </Section>
  );
}

/* ----------------------------------------------------------------------------
   Alerts
   --------------------------------------------------------------------------*/

function AlertsSection() {
  return (
    <Section
      id="alerts"
      number="14"
      eyebrow="Feedback"
      title="Alerts"
      description="Persistent banners for state that needs visibility but not urgency. For urgent moments, prefer toasts."
    >
      <Example label="Variants" density="default" align="start">
        <div className="space-y-3 w-full">
          <Alert variant="info">
            <AlertTitle>Soft launch enabled for 12 reviewers.</AlertTitle>
            <AlertDescription>
              Audit instrumentation is on. The full team will be enrolled on May 6.
            </AlertDescription>
          </Alert>
          <Alert variant="success" onDismiss={() => undefined}>
            <AlertTitle>Migration 0042 applied successfully.</AlertTitle>
            <AlertDescription>
              50,318 records backfilled. Lineage column is live in
              <code className="font-mono mx-1 px-1 py-0.5 bg-success-soft border border-success/15 rounded-[3px]">
                clinical_facts
              </code>
              .
            </AlertDescription>
          </Alert>
          <Alert variant="warning">
            <AlertTitle>FHIR validator deprecation — November 2026.</AlertTitle>
            <AlertDescription>
              R4 bundles will stop validating against the legacy schema on Nov 1. Migrate before the
              freeze.
            </AlertDescription>
          </Alert>
          <Alert variant="danger">
            <AlertTitle>Cerner connector authentication failed.</AlertTitle>
            <AlertDescription>
              The OAuth token expired 14 minutes ago. New records aren't syncing. Re-authenticate to
              resume.
            </AlertDescription>
          </Alert>
        </div>
      </Example>
    </Section>
  );
}

/* ----------------------------------------------------------------------------
   Toasts
   --------------------------------------------------------------------------*/

function ToastsSection() {
  return (
    <Section
      id="toasts"
      number="15"
      eyebrow="Feedback"
      title="Toasts"
      description="Ephemeral, non-blocking feedback for completed work or quick errors. Driven by Sonner — appears bottom-right by default."
    >
      <Example label="Triggers">
        <Button
          variant="secondary"
          size="sm"
          leadingIcon={<Check />}
          onClick={() =>
            toast.success("Record approved", {
              description: "PT-04812 · canonical merge in 1.2s"
            })
          }
        >
          Success
        </Button>
        <Button
          variant="secondary"
          size="sm"
          leadingIcon={<Info />}
          onClick={() =>
            toast.info("New reviewer assigned", {
              description: "Maya Chen will take over the queue at 14:00."
            })
          }
        >
          Info
        </Button>
        <Button
          variant="secondary"
          size="sm"
          leadingIcon={<AlertCircle />}
          onClick={() =>
            toast.warning("Schema drift detected", {
              description: "The athena.PatientID field changed shape."
            })
          }
        >
          Warning
        </Button>
        <Button
          variant="secondary"
          size="sm"
          leadingIcon={<AlertCircle />}
          onClick={() =>
            toast.error("Connector auth failed", {
              description: "Cerner OAuth token expired 14 min ago.",
              action: { label: "Re-auth", onClick: () => undefined }
            })
          }
        >
          Error
        </Button>
        <Button
          variant="secondary"
          size="sm"
          leadingIcon={<RefreshCw />}
          onClick={() => {
            const id = toast.loading("Importing 3,402 records…");
            setTimeout(
              () =>
                toast.success("Import complete", {
                  id,
                  description: "3,402 records · 1.4s"
                }),
              2000
            );
          }}
        >
          Promise
        </Button>
        <Button
          variant="secondary"
          size="sm"
          leadingIcon={<Mail />}
          onClick={() =>
            toast("Daily audit digest is ready", {
              description: "Sent to 4 reviewers · 2026-04-30 06:00",
              action: { label: "Open", onClick: () => undefined }
            })
          }
        >
          With action
        </Button>
      </Example>
    </Section>
  );
}

/* ----------------------------------------------------------------------------
   Empty state
   --------------------------------------------------------------------------*/

function EmptyStateSection() {
  return (
    <Section
      id="empty"
      number="16"
      eyebrow="Feedback"
      title="Empty states"
      description="What the user sees when a list, page, or query returns nothing. The shape of an empty state should suggest the next action."
    >
      <Example label="Default" surface="muted">
        <div className="w-full max-w-lg mx-auto">
          <EmptyState
            icon={<Inbox />}
            title="No records pending review"
            description="The reviewer queue is clear. Records will appear here as the ingestion pipeline produces new candidate facts."
            action={
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" leadingIcon={<Settings />}>
                  Adjust auto-merge
                </Button>
                <Button variant="primary" size="sm" leadingIcon={<Upload />}>
                  Import records
                </Button>
              </div>
            }
          />
        </div>
      </Example>
    </Section>
  );
}

/* ----------------------------------------------------------------------------
   Tooltips
   --------------------------------------------------------------------------*/

function TooltipSection() {
  return (
    <Section
      id="tooltips"
      number="17"
      eyebrow="Overlays"
      title="Tooltips"
      description="Short, clarifying labels — never essential information. Dark surface, small footprint, fast to dismiss."
    >
      <Example label="Triggers">
        <TooltipSimple content="Connect a new EHR or wearable">
          <Button variant="secondary" size="icon-sm">
            <Plus />
          </Button>
        </TooltipSimple>
        <TooltipSimple content="Refresh the connection" shortcut="⌘R">
          <Button variant="secondary" size="icon-sm">
            <RefreshCw />
          </Button>
        </TooltipSimple>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="secondary" size="sm">
              Hover for rich
            </Button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs p-2.5">
            <div className="space-y-1.5">
              <div className="font-medium">Provenance graph</div>
              <p className="text-canvas/70 leading-snug font-normal">
                Each clinical fact links back to its source span, the model that extracted it, and
                the reviewer signature.
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
        <TooltipSimple content="Disabled — paused integration">
          <span tabIndex={0}>
            <Button variant="secondary" size="sm" disabled>
              Sync now
            </Button>
          </span>
        </TooltipSimple>
      </Example>
    </Section>
  );
}

/* ----------------------------------------------------------------------------
   Hover Card
   --------------------------------------------------------------------------*/

function HoverCardSection() {
  return (
    <Section
      id="hovercards"
      number="18"
      eyebrow="Overlays"
      title="Hover cards"
      description="Rich previews on hover — for surfacing context without leaving the current row. Heavier than a tooltip, lighter than a popover."
    >
      <Example label="Reviewer avatar">
        <span className="text-[13px] text-muted">Last reviewed by</span>
        <HoverCard>
          <HoverCardTrigger asChild>
            <button className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink hover:text-accent transition-colors cursor-pointer">
              <Avatar size="xs">
                <AvatarFallback style={{ background: "#3F4E8A", color: "white" }}>
                  MC
                </AvatarFallback>
              </Avatar>
              Maya Chen
            </button>
          </HoverCardTrigger>
          <HoverCardContent className="w-[300px] p-0">
            <div className="p-3.5 flex items-start gap-3 border-b border-line">
              <Avatar size="lg">
                <AvatarFallback style={{ background: "#3F4E8A", color: "white" }}>
                  MC
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-ink">Maya Chen</div>
                <div className="text-[12px] text-muted">Clinical Informatics Lead</div>
                <div className="mt-1.5 flex items-center gap-1">
                  <Badge variant="success" size="sm" dot>
                    On call
                  </Badge>
                  <Badge variant="muted" size="sm">
                    PT
                  </Badge>
                </div>
              </div>
            </div>
            <div className="p-3.5 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="font-mono text-[14px] text-ink font-semibold">142</div>
                <div className="text-[10.5px] uppercase tracking-[0.05em] text-muted">
                  Reviewed
                </div>
              </div>
              <div>
                <div className="font-mono text-[14px] text-ink font-semibold">0.97</div>
                <div className="text-[10.5px] uppercase tracking-[0.05em] text-muted">
                  Agreement
                </div>
              </div>
              <div>
                <div className="font-mono text-[14px] text-ink font-semibold">11h</div>
                <div className="text-[10.5px] uppercase tracking-[0.05em] text-muted">
                  Avg SLA
                </div>
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>
        <span className="text-[13px] text-muted">
          on
          <span className="font-mono text-ink ml-1">2026-04-29 14:22</span>
        </span>
      </Example>
    </Section>
  );
}

/* ----------------------------------------------------------------------------
   Dropdown menus
   --------------------------------------------------------------------------*/

function DropdownMenuSection() {
  const [view, setView] = React.useState("table");
  const [showProvenance, setShowProvenance] = React.useState(true);
  const [showAudit, setShowAudit] = React.useState(false);
  return (
    <Section
      id="dropdowns"
      number="19"
      eyebrow="Overlays"
      title="Dropdown menus"
      description="The workhorse menu. Anchored to a trigger, supports icons, shortcuts, sections, and destructive actions."
    >
      <Example label="Anatomy">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" trailingIcon={<ChevronRight className="rotate-90" />}>
              Actions
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Record actions</DropdownMenuLabel>
            <DropdownMenuItem shortcut="⌘ E">
              <Edit />
              Edit details
            </DropdownMenuItem>
            <DropdownMenuItem shortcut="⌘ ⇧ C">
              <Copy />
              Copy reference link
            </DropdownMenuItem>
            <DropdownMenuItem shortcut="⌘ S">
              <Archive />
              Archive
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Sharing</DropdownMenuLabel>
            <DropdownMenuItem>
              <Share2 />
              Share with reviewer
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Mail />
              Email PDF
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive shortcut="⌫">
              <Trash2 />
              Delete record
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" leadingIcon={<Eye />} trailingIcon={<ChevronRight className="rotate-90" />}>
              View
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Layout</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={view} onValueChange={setView}>
              <DropdownMenuRadioItem value="table">Table</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="grid">Grid</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="timeline">Timeline</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Show columns</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={showProvenance}
              onCheckedChange={setShowProvenance}
            >
              Provenance
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={showAudit}
              onCheckedChange={setShowAudit}
            >
              Audit trail
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <Eye />
              View
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Edit />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Copy />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive>
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Example>
    </Section>
  );
}

/* ----------------------------------------------------------------------------
   Popovers
   --------------------------------------------------------------------------*/

function PopoverSection() {
  return (
    <Section
      id="popovers"
      number="20"
      eyebrow="Overlays"
      title="Popovers"
      description="Lightweight floating panels for editable controls — date pickers, color pickers, quick filters."
    >
      <Example label="Filter popover">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="secondary" size="sm" leadingIcon={<Filter />}>
              Filter
              <Badge variant="accent" size="sm" className="ml-1">
                3
              </Badge>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-0">
            <div className="px-3 py-2.5 border-b border-line flex items-center justify-between">
              <div className="text-[13px] font-medium text-ink">Filter records</div>
              <Button variant="ghost" size="xs">
                Clear
              </Button>
            </div>
            <div className="p-3 space-y-3">
              <div>
                <Label className="mb-1.5 block">Status</Label>
                <div className="flex flex-wrap gap-1">
                  {["Pending", "Reviewed", "Flagged"].map((s) => (
                    <Badge
                      key={s}
                      variant={s === "Pending" ? "accent" : "neutral"}
                      className="cursor-pointer"
                    >
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label className="mb-1.5 block">Source</Label>
                <Combobox options={sourceOptions.slice(0, 5)} placeholder="Any source" width="100%" />
              </div>
              <div>
                <Label className="mb-1.5 block">Date range</Label>
                <Input
                  size="sm"
                  placeholder="Apr 1 — Apr 30, 2026"
                  leadingIcon={<Clock />}
                />
              </div>
            </div>
            <div className="px-3 py-2 border-t border-line flex justify-end gap-2 bg-surface-muted/40">
              <Button variant="ghost" size="sm">
                Cancel
              </Button>
              <Button variant="primary" size="sm">
                Apply
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="secondary" size="sm" leadingIcon={<Settings2 />}>
              Display
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64">
            <div className="text-[10.5px] uppercase tracking-[0.08em] font-semibold text-subtle mb-2">
              Density
            </div>
            <div className="grid grid-cols-3 gap-1">
              {["Compact", "Default", "Comfy"].map((d, i) => (
                <button
                  key={d}
                  className={cn(
                    "h-7 px-2 text-[12px] rounded-[5px] border cursor-pointer",
                    i === 1
                      ? "bg-accent-soft border-accent/30 text-accent-soft-foreground"
                      : "border-line hover:border-line-strong text-ink-2"
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
            <Separator className="my-3" />
            <div className="text-[10.5px] uppercase tracking-[0.08em] font-semibold text-subtle mb-2">
              Theme
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-ink-2">Reduce motion</span>
              <Switch size="sm" />
            </div>
          </PopoverContent>
        </Popover>
      </Example>
    </Section>
  );
}

/* ----------------------------------------------------------------------------
   Modals
   --------------------------------------------------------------------------*/

function ModalsSection() {
  return (
    <Section
      id="modals"
      number="21"
      eyebrow="Overlays"
      title="Modals"
      description="Centered dialogs for focused work — confirmations, single-purpose forms, and detail views."
    >
      <Example label="Triggers">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="primary" size="sm" leadingIcon={<Plus />}>
              New record
            </Button>
          </DialogTrigger>
          <DialogContent size="md">
            <DialogHeader>
              <DialogTitle>Create canonical record</DialogTitle>
              <DialogDescription>
                Manually create a record outside of an import job. Provenance will be tagged
                <span className="font-mono mx-1">manual:eli</span>.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="m-1" required>
                    Patient ID
                  </Label>
                  <Input id="m-1" placeholder="PT-00000" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="m-2">Source</Label>
                  <Select defaultValue="manual">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual entry</SelectItem>
                      <SelectItem value="import">Import job</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-3">Note</Label>
                <Textarea id="m-3" rows={3} placeholder="Reason for manual creation…" />
              </div>
            </DialogBody>
            <DialogFooter>
              <Button variant="ghost" size="sm">
                Cancel
              </Button>
              <Button variant="primary" size="sm">
                Create record
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="destructive" size="sm" leadingIcon={<Trash2 />}>
              Disconnect
            </Button>
          </DialogTrigger>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle>Disconnect Cerner integration?</DialogTitle>
              <DialogDescription>
                Inbound bundles will stop. Pending review tasks remain in queue. This action is
                reversible — you can reconnect at any time.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" size="sm">
                Cancel
              </Button>
              <Button variant="destructive" size="sm">
                Disconnect
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Example>
    </Section>
  );
}

/* ----------------------------------------------------------------------------
   Sheets / Drawers
   --------------------------------------------------------------------------*/

function DrawerSection() {
  return (
    <Section
      id="drawers"
      number="22"
      eyebrow="Overlays"
      title="Drawers"
      description="Side-anchored panels for context that is auxiliary but persistent — record detail, settings, audit trails."
    >
      <Example label="Record detail">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary" size="sm" leadingIcon={<Eye />}>
              Open record drawer
            </Button>
          </SheetTrigger>
          <SheetContent side="right" width="520px" className="flex flex-col p-0">
            <SheetHeader>
              <div className="flex items-center justify-between">
                <Badge variant="warning" size="sm" dot>
                  Pending review
                </Badge>
                <span className="font-mono text-[11.5px] text-muted">
                  PT-04812 · v3
                </span>
              </div>
              <SheetTitle className="mt-2">Avery Marsh — Cardiology follow-up</SheetTitle>
              <SheetDescription>
                Extracted from Epic bundle on 2026-04-29 · merge candidate · awaiting reviewer
              </SheetDescription>
            </SheetHeader>
            <SheetBody className="space-y-5">
              <div>
                <div className="text-[10.5px] uppercase tracking-[0.08em] font-semibold text-subtle mb-2">
                  Vitals
                </div>
                <div className="rounded-[8px] border border-line overflow-hidden">
                  {[
                    { metric: "BP", value: "128/82", reference: "120/80 mmHg", flag: "watch" },
                    { metric: "HR", value: "72", reference: "60–100 bpm", flag: "normal" },
                    { metric: "SpO₂", value: "97", reference: "≥ 95 %", flag: "normal" },
                    { metric: "Temp", value: "36.8", reference: "36.1–37.5 °C", flag: "normal" }
                  ].map((v) => (
                    <div
                      key={v.metric}
                      className="flex items-baseline gap-3 px-3 py-2 border-b border-line last:border-b-0 bg-surface"
                    >
                      <span className="text-[12px] font-medium text-muted w-14">
                        {v.metric}
                      </span>
                      <span className="font-mono text-[14px] text-ink tabular-nums">
                        {v.value}
                      </span>
                      <span className="text-[11.5px] text-subtle font-mono ml-auto">
                        {v.reference}
                      </span>
                      {v.flag === "watch" ? (
                        <Badge variant="warning" size="sm" dot>
                          Watch
                        </Badge>
                      ) : (
                        <Badge variant="success" size="sm" dot>
                          Normal
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[10.5px] uppercase tracking-[0.08em] font-semibold text-subtle mb-2">
                  Provenance
                </div>
                <div className="rounded-[8px] border border-line overflow-hidden">
                  {[
                    {
                      icon: <FilePlus className="size-3.5" />,
                      label: "Source document",
                      val: "epic_bundle_2026-04-29.fhir"
                    },
                    {
                      icon: <Bot className="size-3.5" />,
                      label: "Extracted by",
                      val: "ov-extractor v0.4.2"
                    },
                    {
                      icon: <Layers className="size-3.5" />,
                      label: "Span",
                      val: "L412–L430"
                    },
                    {
                      icon: <ShieldCheck className="size-3.5" />,
                      label: "Confidence",
                      val: "0.91"
                    }
                  ].map((p) => (
                    <div
                      key={p.label}
                      className="flex items-center gap-3 px-3 py-2 border-b border-line last:border-b-0 text-[12.5px]"
                    >
                      <span className="text-muted flex items-center gap-2 w-36">
                        {p.icon}
                        {p.label}
                      </span>
                      <span className="font-mono text-ink-2">{p.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </SheetBody>
            <SheetFooter>
              <Button variant="ghost" size="sm">
                Reject
              </Button>
              <Button variant="secondary" size="sm">
                Save & continue
              </Button>
              <Button variant="primary" size="sm" trailingIcon={<ArrowRight />}>
                Approve
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary" size="sm" leadingIcon={<Settings />}>
              Settings drawer
            </Button>
          </SheetTrigger>
          <SheetContent side="left" width="400px">
            <SheetHeader>
              <SheetTitle>Workspace settings</SheetTitle>
              <SheetDescription>
                These changes apply to the entire OpenVitals workspace.
              </SheetDescription>
            </SheetHeader>
            <SheetBody className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-medium text-ink">Auto-merge</div>
                  <div className="text-[11.5px] text-muted">≥ 0.95 confidence</div>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-medium text-ink">Audit digest</div>
                  <div className="text-[11.5px] text-muted">Weekly · Monday 06:00</div>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-medium text-ink">Quarantine on drift</div>
                  <div className="text-[11.5px] text-muted">Hold suspicious bundles</div>
                </div>
                <Switch />
              </div>
            </SheetBody>
          </SheetContent>
        </Sheet>
      </Example>
    </Section>
  );
}

/* ----------------------------------------------------------------------------
   Command palette
   --------------------------------------------------------------------------*/

function CommandSection({
  cmdOpen,
  onOpenChange
}: {
  cmdOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Section
      id="command"
      number="23"
      eyebrow="Overlays"
      title="Command palette"
      description="Search, navigation, and quick actions in one keyboard-first surface. Triggered by ⌘ K from anywhere."
    >
      <Example label="Trigger">
        <Button
          variant="secondary"
          size="sm"
          leadingIcon={<Command />}
          shortcut="⌘ K"
          onClick={() => onOpenChange(true)}
        >
          Open command palette
        </Button>
      </Example>

      <CommandDialog open={cmdOpen} onOpenChange={onOpenChange}>
        <CommandInput placeholder="Search records, run actions…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Suggested">
            <CommandItem onSelect={() => onOpenChange(false)}>
              <HeartPulse />
              Open record review queue
              <CommandShortcut>G R</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => onOpenChange(false)}>
              <Plus />
              Create canonical record
              <CommandShortcut>⌘ N</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => onOpenChange(false)}>
              <Plug />
              Connect new integration
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Records">
            {vitals.slice(0, 4).map((v) => (
              <CommandItem key={v.id} onSelect={() => onOpenChange(false)}>
                <User />
                {v.patient}
                <span className="ml-2 font-mono text-[11px] text-subtle">
                  {v.patientCode}
                </span>
                <CommandShortcut>{v.metric}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Settings">
            <CommandItem>
              <Settings />
              Workspace preferences
            </CommandItem>
            <CommandItem>
              <ShieldCheck />
              Audit log
            </CommandItem>
            <CommandItem>
              <LogOut />
              Sign out
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </Section>
  );
}

/* ----------------------------------------------------------------------------
   Tabs
   --------------------------------------------------------------------------*/

function TabsSection() {
  return (
    <Section
      id="tabs"
      number="24"
      eyebrow="Navigation"
      title="Tabs"
      description="Three flavors. Underline for primary navigation, pill for filtered views, segmented for binary or ternary toggles."
    >
      <Example label="Underline" density="compact" align="start">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList variant="underline">
            <TabsTrigger value="overview">
              <LayoutGrid />
              Overview
            </TabsTrigger>
            <TabsTrigger value="vitals">
              <HeartPulse />
              Vitals
              <Badge variant="accent" size="sm" className="ml-1">
                3
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="provenance">
              <Layers />
              Provenance
            </TabsTrigger>
            <TabsTrigger value="audit">
              <ShieldCheck />
              Audit trail
            </TabsTrigger>
            <TabsTrigger value="raw" disabled>
              <FileJson />
              Raw bundle
            </TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="text-[13px] text-muted">
            Patient overview with vitals summary, recent encounters, and active flags.
          </TabsContent>
          <TabsContent value="vitals" className="text-[13px] text-muted">
            Vital sign trends with reference ranges.
          </TabsContent>
          <TabsContent value="provenance" className="text-[13px] text-muted">
            Source document, extraction span, and reviewer signatures for every fact.
          </TabsContent>
        </Tabs>
      </Example>

      <Example label="Pill" density="compact" align="start">
        <Tabs defaultValue="all">
          <TabsList variant="pill">
            <TabsTrigger value="all">All sources</TabsTrigger>
            <TabsTrigger value="ehr">EHR</TabsTrigger>
            <TabsTrigger value="wearable">Wearables</TabsTrigger>
            <TabsTrigger value="manual">Manual</TabsTrigger>
          </TabsList>
        </Tabs>
      </Example>

      <Example label="Segmented" density="compact" align="start">
        <Tabs defaultValue="day" className="w-72">
          <TabsList variant="segmented">
            <TabsTrigger value="day">Day</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="year">Year</TabsTrigger>
          </TabsList>
        </Tabs>
      </Example>
    </Section>
  );
}

/* ----------------------------------------------------------------------------
   Breadcrumb
   --------------------------------------------------------------------------*/

function BreadcrumbSection() {
  return (
    <Section
      id="breadcrumb"
      number="25"
      eyebrow="Navigation"
      title="Breadcrumb"
      description="Hierarchy at a glance. Used in the page header to anchor the user's location in the workspace."
    >
      <Example label="Default">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Workspace</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Records</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Pending review</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Avery Marsh — PT-04812</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </Example>
    </Section>
  );
}

/* ----------------------------------------------------------------------------
   Tables
   --------------------------------------------------------------------------*/

const sourceIconMap: Record<string, React.ReactElement> = {
  Epic: <Github className="size-3.5" />,
  Cerner: <Database className="size-3.5" />,
  "Apple Health": <Heart className="size-3.5" />,
  Withings: <Activity className="size-3.5" />,
  Dexcom: <Sparkles className="size-3.5" />
};

function TablesSection() {
  const [sortKey, setSortKey] = React.useState<"records" | "name" | "delta" | null>("records");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");
  const [selected, setSelected] = React.useState<Record<string, boolean>>({});

  const sorted = [...integrations].sort((a, b) => {
    if (!sortKey) return 0;
    const va = a[sortKey] as number | string;
    const vb = b[sortKey] as number | string;
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const onSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  return (
    <Section
      id="tables"
      number="26"
      eyebrow="Data"
      title="Tables"
      description="The workhorse surface for clinical data. Sortable headers, row-level actions, hover affordances, and a selectable mode for bulk operations."
    >
      <Example label="Integrations" surface="muted" density="compact" align="start">
        <Card className="overflow-hidden w-full">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <div>
              <div className="text-[14px] font-semibold text-ink">Active integrations</div>
              <div className="text-[12px] text-muted">
                {integrations.length} connectors · 362,765 total records
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Input
                size="sm"
                placeholder="Search…"
                leadingIcon={<Search />}
                className="w-56"
              />
              <Button variant="secondary" size="sm" leadingIcon={<Filter />}>
                Filter
              </Button>
              <Button variant="primary" size="sm" leadingIcon={<Plus />}>
                Connect
              </Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      Object.keys(selected).length === sorted.length
                        ? true
                        : Object.keys(selected).length > 0
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={(c) => {
                      if (c) {
                        const next: Record<string, boolean> = {};
                        sorted.forEach((i) => (next[i.id] = true));
                        setSelected(next);
                      } else setSelected({});
                    }}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader
                    direction={sortKey === "name" ? sortDir : null}
                    onClick={() => onSort("name")}
                  >
                    Connector
                  </SortableHeader>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <SortableHeader
                    direction={sortKey === "records" ? sortDir : null}
                    onClick={() => onSort("records")}
                  >
                    Records
                  </SortableHeader>
                </TableHead>
                <TableHead>
                  <SortableHeader
                    direction={sortKey === "delta" ? sortDir : null}
                    onClick={() => onSort("delta")}
                  >
                    Δ 30d
                  </SortableHeader>
                </TableHead>
                <TableHead>Last sync</TableHead>
                <TableHead className="text-right w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((i) => {
                const status =
                  i.status === "connected"
                    ? { variant: "success" as const, label: "Connected" }
                    : i.status === "syncing"
                      ? { variant: "info" as const, label: "Syncing" }
                      : i.status === "issue"
                        ? { variant: "warning" as const, label: "Attention" }
                        : { variant: "muted" as const, label: "Paused" };
                return (
                  <TableRow key={i.id} selected={!!selected[i.id]}>
                    <TableCell>
                      <Checkbox
                        checked={!!selected[i.id]}
                        onCheckedChange={(c) => {
                          setSelected((s) => {
                            const next = { ...s };
                            if (c) next[i.id] = true;
                            else delete next[i.id];
                            return next;
                          });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span className="size-7 rounded-[6px] bg-surface-muted border border-line flex items-center justify-center text-muted">
                          <Building2 className="size-3.5" />
                        </span>
                        <div>
                          <div className="text-ink font-medium">{i.name}</div>
                          <div className="text-[11.5px] text-muted">{i.vendor}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant} size="sm" dot>
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">
                      {i.records.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center gap-0.5 font-mono",
                          i.delta > 0 && "text-success",
                          i.delta < 0 && "text-danger",
                          i.delta === 0 && "text-muted"
                        )}
                      >
                        {i.delta > 0 ? (
                          <TrendingUp className="size-3" />
                        ) : i.delta < 0 ? (
                          <TrendingDown className="size-3" />
                        ) : (
                          <Dot className="size-3" />
                        )}
                        {i.delta > 0 && "+"}
                        {i.delta}%
                      </span>
                    </TableCell>
                    <TableCell className="text-muted">{i.lastSync}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-xs">
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Settings />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <RefreshCw />
                            Refresh
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem destructive>
                            <Plug />
                            Disconnect
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </Example>

      <Example label="Vitals — with sparklines" surface="muted" density="compact" align="start">
        <Card className="overflow-hidden w-full">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Patient</TableHead>
                <TableHead>Metric</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Trend</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vitals.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar size="sm">
                        <AvatarFallback
                          style={{
                            background: "#" + v.patientCode.slice(-3).padEnd(6, "f"),
                            color: "white"
                          }}
                        >
                          {v.patient
                            .split(" ")
                            .map((s) => s[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-ink font-medium">{v.patient}</div>
                        <div className="text-[11.5px] font-mono text-subtle">
                          {v.patientCode}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5">
                      {v.metric === "BP" ? (
                        <Activity className="size-3.5 text-muted" />
                      ) : v.metric === "HR" ? (
                        <HeartPulse className="size-3.5 text-muted" />
                      ) : (
                        <Circle className="size-3.5 text-muted" />
                      )}
                      {v.metric}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "font-mono text-[14px]",
                        v.flag === "critical" && "text-danger",
                        v.flag === "watch" && "text-warning"
                      )}
                    >
                      {v.value}
                    </span>
                  </TableCell>
                  <TableCell className="text-[11.5px] font-mono text-subtle">
                    {v.reference}
                  </TableCell>
                  <TableCell>
                    <Sparkline data={v.trend} tone="auto" />
                  </TableCell>
                  <TableCell>
                    <Badge variant="neutral" size="sm">
                      {sourceIconMap[v.source] ?? <Cloud className="size-3" />}
                      {v.source}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-[12px] text-muted">
                    {v.timestamp}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-line bg-surface-muted/40">
            <span className="text-[12px] text-muted">
              Showing {vitals.length} of 1,284 readings
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon-xs" disabled>
                <ChevronRight className="rotate-180" />
              </Button>
              <span className="text-[12px] font-mono text-muted px-2">1 / 32</span>
              <Button variant="ghost" size="icon-xs">
                <ChevronRight />
              </Button>
            </div>
          </div>
        </Card>
      </Example>
    </Section>
  );
}

/* ----------------------------------------------------------------------------
   Calendar
   --------------------------------------------------------------------------*/

function CalendarSection() {
  const [single, setSingle] = React.useState<Date | undefined>(new Date(2026, 3, 30));
  const [range, setRange] = React.useState<DateRange | undefined>({
    from: new Date(2026, 3, 12),
    to: new Date(2026, 3, 26)
  });
  return (
    <Section
      id="calendar"
      number="27"
      eyebrow="Data"
      title="Calendar"
      description="Date selection — single date and range. Used in audit log filters, scheduling, and digest configuration."
    >
      <Example label="Single & range" align="start">
        <div className="grid grid-cols-2 gap-4 w-full">
          <div className="rounded-[10px] border border-line bg-surface">
            <div className="px-4 py-2.5 border-b border-line flex items-center justify-between">
              <span className="text-[12px] font-medium text-ink">Single date</span>
              <span className="font-mono text-[11.5px] text-muted">
                {single?.toISOString().slice(0, 10) ?? "—"}
              </span>
            </div>
            <Calendar mode="single" selected={single} onSelect={setSingle} />
          </div>
          <div className="rounded-[10px] border border-line bg-surface">
            <div className="px-4 py-2.5 border-b border-line flex items-center justify-between">
              <span className="text-[12px] font-medium text-ink">Date range</span>
              <span className="font-mono text-[11.5px] text-muted">
                {range?.from?.toISOString().slice(0, 10) ?? "—"} →
                {" " + (range?.to?.toISOString().slice(0, 10) ?? "—")}
              </span>
            </div>
            <Calendar mode="range" selected={range} onSelect={setRange} numberOfMonths={1} />
          </div>
        </div>
      </Example>

      <Example label="In a popover" align="start">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="secondary" size="sm" leadingIcon={<Clock />}>
              {single?.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric"
              }) ?? "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar mode="single" selected={single} onSelect={setSingle} />
          </PopoverContent>
        </Popover>
      </Example>
    </Section>
  );
}

/* ----------------------------------------------------------------------------
   Charts
   --------------------------------------------------------------------------*/

function ChartsSection() {
  return (
    <Section
      id="charts"
      number="28"
      eyebrow="Data"
      title="Charts"
      description="Composed on top of recharts. The shared visual rhythm — same gridlines, same tick treatment, same tooltip — keeps charts feeling like one family."
    >
      <Example label="Area trend — heart rate" surface="muted" density="compact" align="start">
        <Card className="w-full">
          <CardHeader className="flex-row items-baseline justify-between border-none pb-0">
            <div>
              <CardTitle>Avery M. — heart rate, 24h</CardTitle>
              <CardDescription>
                Wearable telemetry merged with manual readings · 2026-04-29
              </CardDescription>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[32px] font-light tracking-[-0.035em] leading-none text-ink tabular-nums">
                72
              </span>
              <span className="text-[13px] text-muted">bpm avg</span>
              <Badge variant="success" size="sm" dot>
                Normal
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <AreaTrend data={heartRateSeries} dataKey="bpm" unit="bpm" height={200} />
          </CardContent>
        </Card>
      </Example>

      <Example label="Multi-line — benchmark" surface="muted" density="compact" align="start">
        <div className="grid grid-cols-3 gap-3 w-full">
          <Card className="col-span-2">
            <CardHeader className="border-none pb-0">
              <CardTitle>Department benchmark</CardTitle>
              <CardDescription>Observed agreement vs published baseline</CardDescription>
            </CardHeader>
            <CardContent>
              <LineTrend
                data={benchmarkSeries}
                series={[
                  { key: "observed", label: "OpenVitals", color: "var(--accent)" },
                  {
                    key: "baseline",
                    label: "Baseline",
                    color: "var(--ink-2)"
                  }
                ]}
                xKey="x"
                unit="%"
                height={220}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="border-none pb-0">
              <CardTitle>Source mix</CardTitle>
              <CardDescription>Total records, last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <DonutChart
                data={sourceMix}
                centerLabel="Records"
                centerValue="362.7k"
                height={200}
              />
              <div className="mt-3 space-y-1.5">
                {sourceMix.slice(0, 4).map((s, i) => {
                  const palette = [
                    "var(--chart-1)",
                    "var(--chart-2)",
                    "var(--chart-3)",
                    "var(--chart-4)"
                  ];
                  return (
                    <div key={s.name} className="flex items-center gap-2 text-[12px]">
                      <span
                        className="size-2 rounded-[2px]"
                        style={{ background: palette[i] }}
                      />
                      <span className="text-ink-2">{s.name}</span>
                      <span className="ml-auto font-mono text-muted">
                        {(s.value / 1000).toFixed(1)}k
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </Example>

      <Example label="Bar trend & stacked area" surface="muted" density="compact" align="start">
        <div className="grid grid-cols-2 gap-3 w-full">
          <Card>
            <CardHeader className="border-none pb-0">
              <CardTitle>Daily ingestion</CardTitle>
              <CardDescription>FHIR bundles processed</CardDescription>
            </CardHeader>
            <CardContent>
              <BarTrend
                data={Array.from({ length: 14 }, (_, i) => ({
                  x: `${i + 16}`,
                  v: 30 + Math.round(Math.sin(i / 1.5) * 15 + Math.random() * 10)
                }))}
                dataKey="v"
                unit="bundles"
                height={180}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="border-none pb-0">
              <CardTitle>Connector cohorts</CardTitle>
              <CardDescription>Connection state, year-to-date</CardDescription>
            </CardHeader>
            <CardContent>
              <StackedArea
                data={cohortSeries}
                series={[
                  { key: "Connected", label: "Connected" },
                  { key: "Pending", label: "Pending" },
                  { key: "Failed", label: "Failed" }
                ]}
                xKey="x"
                height={200}
              />
            </CardContent>
          </Card>
        </div>
      </Example>
    </Section>
  );
}
