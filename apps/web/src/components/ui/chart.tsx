import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { cn } from "../../lib/cn";

/* -----------------------------------------------------------
   Shared building blocks for recharts
   ---------------------------------------------------------*/

const accent = "var(--accent)";
const ink = "var(--ink)";
const ink2 = "var(--ink-2)";
const muted = "var(--muted)";
const subtle = "var(--subtle)";
const line = "var(--line)";

const tickStyle = {
  fill: muted,
  fontSize: 11,
  fontFamily: "var(--font-mono)"
};

interface TooltipPayloadItem {
  value?: number | string;
  name?: string;
  dataKey?: string;
  color?: string;
  payload?: Record<string, unknown>;
}

// Recharts' Tooltip `content` callback uses a complex internal generic type.
// We intentionally accept `any` here — the tooltip is the only place we
// touch the recharts props directly, and the loss of type safety is bounded
// to this function.
function renderChartTooltip(unit?: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (props: any) => {
    const active = props.active as boolean | undefined;
    const payload = props.payload as ReadonlyArray<TooltipPayloadItem> | undefined;
    const label = props.label as string | number | undefined;
    if (!active || !payload?.length) return null;
    return (
      <ChartTooltipBody
        payload={payload}
        {...(label !== undefined ? { label } : {})}
        {...(unit !== undefined ? { unit } : {})}
      />
    );
  };
}

interface ChartTooltipBodyProps {
  payload: ReadonlyArray<TooltipPayloadItem>;
  label?: string | number;
  formatter?: (value: number | string) => string;
  unit?: string;
}

function ChartTooltipBody(props: ChartTooltipBodyProps) {
  const { payload, label, formatter, unit } = props;
  return (
    <div
      className={cn(
        "rounded-[8px] border border-line bg-surface px-2.5 py-2 shadow-pop",
        "text-[12px] font-mono"
      )}
    >
      {label !== undefined && (
        <div className="text-[10.5px] uppercase tracking-[0.06em] text-subtle font-semibold mb-1">
          {label}
        </div>
      )}
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="size-2 rounded-[2px] shrink-0"
              style={{ background: entry.color }}
            />
            <span className="text-ink-2 capitalize">{entry.name}</span>
            <span className="ml-auto text-ink font-medium tabular-nums">
              {formatter ? formatter(entry.value as number) : entry.value}
              {unit && <span className="text-muted ml-0.5">{unit}</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -----------------------------------------------------------
   Area chart
   ---------------------------------------------------------*/

export function AreaTrend({
  data,
  dataKey,
  xKey = "x",
  height = 220,
  unit,
  className
}: {
  data: Array<Record<string, number | string>>;
  dataKey: string;
  xKey?: string;
  height?: number;
  unit?: string;
  className?: string;
}) {
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity={0.18} />
              <stop offset="100%" stopColor={accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="0" stroke={line} vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={tickStyle}
            tickLine={false}
            axisLine={{ stroke: line }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={tickStyle}
            tickLine={false}
            axisLine={false}
            width={30}
          />
          <Tooltip
            content={renderChartTooltip(unit)}
            cursor={{ stroke: subtle, strokeDasharray: "3 3" }}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={accent}
            strokeWidth={1.75}
            fill="url(#areaGradient)"
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* -----------------------------------------------------------
   Multi-line chart
   ---------------------------------------------------------*/

export function LineTrend({
  data,
  series,
  xKey = "x",
  height = 240,
  unit,
  showLegend = true,
  className
}: {
  data: Array<Record<string, number | string>>;
  series: { key: string; label: string; color?: string }[];
  xKey?: string;
  height?: number;
  unit?: string;
  showLegend?: boolean;
  className?: string;
}) {
  const palette = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="0" stroke={line} vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={tickStyle}
            tickLine={false}
            axisLine={{ stroke: line }}
            interval="preserveStartEnd"
          />
          <YAxis tick={tickStyle} tickLine={false} axisLine={false} width={30} />
          <Tooltip
            content={renderChartTooltip(unit)}
            cursor={{ stroke: subtle, strokeDasharray: "3 3" }}
          />
          {showLegend && (
            <Legend
              iconType="circle"
              iconSize={6}
              wrapperStyle={{
                fontSize: 11,
                color: ink2,
                fontFamily: "var(--font-sans)",
                paddingTop: 8
              }}
            />
          )}
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color ?? palette[i % palette.length]}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3.5, strokeWidth: 2, stroke: "var(--surface)" }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* -----------------------------------------------------------
   Bar chart
   ---------------------------------------------------------*/

export function BarTrend({
  data,
  dataKey,
  xKey = "x",
  height = 200,
  unit,
  className
}: {
  data: Array<Record<string, number | string>>;
  dataKey: string;
  xKey?: string;
  height?: number;
  unit?: string;
  className?: string;
}) {
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={4}>
          <CartesianGrid strokeDasharray="0" stroke={line} vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={tickStyle}
            tickLine={false}
            axisLine={{ stroke: line }}
          />
          <YAxis tick={tickStyle} tickLine={false} axisLine={false} width={30} />
          <Tooltip
            content={renderChartTooltip(unit)}
            cursor={{ fill: "var(--surface-strong)", opacity: 0.5 }}
          />
          <Bar dataKey={dataKey} fill={accent} radius={[3, 3, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* -----------------------------------------------------------
   Donut chart with center label
   ---------------------------------------------------------*/

export function DonutChart({
  data,
  height = 180,
  centerLabel,
  centerValue,
  className
}: {
  data: { name: string; value: number; color?: string }[];
  height?: number;
  centerLabel?: string;
  centerValue?: string;
  className?: string;
}) {
  const palette = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
  return (
    <div className={cn("relative w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip content={renderChartTooltip()} />
          <Pie
            data={data}
            innerRadius="60%"
            outerRadius="92%"
            paddingAngle={2}
            dataKey="value"
            stroke="var(--surface)"
            strokeWidth={2}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color ?? palette[i % palette.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      {(centerLabel || centerValue) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {centerValue && (
            <span className="text-[24px] font-semibold tracking-[-0.02em] text-ink tabular-nums leading-none">
              {centerValue}
            </span>
          )}
          {centerLabel && (
            <span className="mt-1 text-[10.5px] uppercase tracking-[0.06em] font-medium text-muted">
              {centerLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* -----------------------------------------------------------
   Spark line — micro chart inline with data
   ---------------------------------------------------------*/

export function Sparkline({
  data,
  dataKey = "v",
  width = 80,
  height = 26,
  tone = "auto",
  className
}: {
  data: Array<Record<string, number>>;
  dataKey?: string;
  width?: number;
  height?: number;
  tone?: "auto" | "accent" | "positive" | "negative";
  className?: string;
}) {
  const first = data[0]?.[dataKey] ?? 0;
  const last = data[data.length - 1]?.[dataKey] ?? 0;
  const resolvedTone =
    tone === "auto" ? (last >= first ? "positive" : "negative") : tone;
  const color =
    resolvedTone === "positive"
      ? "var(--success)"
      : resolvedTone === "negative"
        ? "var(--danger)"
        : "var(--accent)";

  return (
    <div className={cn("inline-block", className)} style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* -----------------------------------------------------------
   Stacked area chart — useful for cohorts
   ---------------------------------------------------------*/

export function StackedArea({
  data,
  series,
  xKey = "x",
  height = 220,
  className
}: {
  data: Array<Record<string, number | string>>;
  series: { key: string; label: string; color?: string }[];
  xKey?: string;
  height?: number;
  className?: string;
}) {
  const palette = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="0" stroke={line} vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={tickStyle}
            tickLine={false}
            axisLine={{ stroke: line }}
          />
          <YAxis tick={tickStyle} tickLine={false} axisLine={false} width={30} />
          <Tooltip
            content={renderChartTooltip()}
            cursor={{ stroke: subtle, strokeDasharray: "3 3" }}
          />
          <Legend
            iconType="circle"
            iconSize={6}
            wrapperStyle={{
              fontSize: 11,
              color: ink2,
              fontFamily: "var(--font-sans)",
              paddingTop: 8
            }}
          />
          {series.map((s, i) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stackId="1"
              stroke={s.color ?? palette[i % palette.length]}
              fill={s.color ?? palette[i % palette.length]}
              fillOpacity={0.85 - i * 0.12}
              strokeWidth={1}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export const chartPalette = {
  ink,
  ink2,
  muted,
  subtle,
  line,
  accent
};
