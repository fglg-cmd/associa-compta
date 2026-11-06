"use client";
/**
 * Graphiques — conventions : marques fines, extrémités arrondies 4 px ancrées
 * à la ligne de base, grille discrète, info-bulle au survol, légende dès
 * 2 séries, valeurs en encre de texte (jamais en couleur de série).
 */
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { formatEUR } from "@associa/accounting";

const axisTick = { fill: "var(--subtle)", fontSize: 11 };
/** Graduations courtes (montants en centimes) : « 2,4 k€ », « 600 € ». */
const compact = (v: number) => {
  const euros = v / 100;
  const abs = Math.abs(euros);
  if (abs >= 1_000_000) return `${(euros / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M€`;
  if (abs >= 1_000) return `${(euros / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} k€`;
  return `${Math.round(euros).toLocaleString("fr-FR")} €`;
};

type Row = Record<string, string | number | null>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: Partial<TooltipContentProps<any, any>>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-44 rounded-xl border border-border bg-surface/95 px-3 py-2.5 text-xs shadow-lg backdrop-blur">
      <div className="mb-1.5 font-medium text-muted">{label}</div>
      {payload.map((p) =>
        p.value == null ? null : (
          <div key={String(p.dataKey)} className="flex items-center gap-2 py-0.5">
            <span className="size-2 rounded-[3px]" style={{ background: p.color }} />
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
            <YAxis tick={axisTick} tickLine={false} axisLine={false} width={52} tickFormatter={compact} />
            <Tooltip cursor={{ fill: "var(--surface-2)", radius: 6 }} content={(p) => <ChartTooltip {...p} />} />
            {series.map((s, i) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={colors[i]} radius={[5, 5, 0, 0]} maxBarSize={20} />
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
          <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="treasury-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} width={52} tickFormatter={compact} domain={[min < 0 ? "auto" : 0, "auto"]} />
            {min < 0 && <ReferenceLine y={0} stroke="var(--negative)" strokeDasharray="3 3" />}
            <Tooltip cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }} content={(p) => <ChartTooltip {...p} />} />
            <Line type="monotone" dataKey="actual" name="Solde réel" stroke="var(--chart-1)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} connectNulls={false} />
            <Area type="monotone" dataKey="projected" stroke="none" fill="url(#treasury-fill)" tooltipType="none" legendType="none" connectNulls={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="projected" name="Projection" stroke="var(--chart-1)" strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
