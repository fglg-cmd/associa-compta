"use client";
/**
 * Graphiques — conventions : marques fines, extrémités arrondies 4 px ancrées
 * à la ligne de base, grille discrète, info-bulle au survol, légende dès
 * 2 séries, valeurs en encre de texte (jamais en couleur de série).
 */
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { formatEUR } from "@associa/accounting";

const axisTick = { fill: "var(--subtle)", fontSize: 11 };
const compact = (v: number) => formatEUR(v, { compact: true }).replace(/\s?€/, " €");

type Row = Record<string, string | number | null>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: Partial<TooltipContentProps<any, any>>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-40 rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="mb-1.5 font-medium text-muted">{label}</div>
      {payload.map((p) =>
        p.value == null ? null : (
          <div key={String(p.dataKey)} className="flex items-center gap-2 py-0.5">
            <span className="h-0.5 w-3 rounded-full" style={{ background: p.color }} />
            <span className="flex-1 text-muted">{p.name}</span>
            <strong className="tabular font-semibold text-foreground">{formatEUR(Number(p.value))}</strong>
          </div>
        ),
      )}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: i.dashed ? "transparent" : i.color, border: i.dashed ? `1.5px dashed ${i.color}` : undefined }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** Deux séries côte à côte (recettes / dépenses, budget / réalisé). */
export function PairedBars({
  data,
  xKey,
  series,
  height = 240,
}: {
  data: Row[];
  xKey: string;
  series: [{ key: string; label: string }, { key: string; label: string }];
  height?: number;
}) {
  const colors = ["var(--chart-1)", "var(--chart-2)"];
  return (
    <div>
      <Legend items={series.map((s, i) => ({ label: s.label, color: colors[i]! }))} />
      <div className="mt-3" style={{ height }} role="img" aria-label={`${series[0].label} et ${series[1].label}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey={xKey} tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} width={64} tickFormatter={compact} />
            <Tooltip cursor={{ fill: "var(--surface-2)" }} content={(p) => <ChartTooltip {...p} />} />
            {series.map((s, i) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={colors[i]} radius={[4, 4, 0, 0]} maxBarSize={18} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Trésorerie : réalisé (trait plein) puis projection (pointillés), une seule série. */
export function TreasuryLine({ data, height = 220 }: { data: { label: string; actual: number | null; projected: number | null }[]; height?: number }) {
  const min = Math.min(0, ...data.flatMap((d) => [d.actual ?? Infinity, d.projected ?? Infinity]));
  return (
    <div>
      <Legend items={[{ label: "Solde réel", color: "var(--chart-1)" }, { label: "Projection", color: "var(--chart-1)", dashed: true }]} />
      <div className="mt-3" style={{ height }} role="img" aria-label="Évolution et projection de la trésorerie">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} width={64} tickFormatter={compact} domain={[min < 0 ? "auto" : 0, "auto"]} />
            {min < 0 && <ReferenceLine y={0} stroke="var(--negative)" strokeDasharray="3 3" />}
            <Tooltip cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }} content={(p) => <ChartTooltip {...p} />} />
            <Line type="monotone" dataKey="actual" name="Solde réel" stroke="var(--chart-1)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} connectNulls={false} />
            <Line type="monotone" dataKey="projected" name="Projection" stroke="var(--chart-1)" strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
