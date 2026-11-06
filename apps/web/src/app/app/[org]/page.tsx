import Link from "next/link";
import { AlertTriangle, ArrowDownLeft, ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, CheckCircle2, Info, Landmark, OctagonAlert, Wallet } from "lucide-react";
import { formatEUR } from "@associa/accounting";
import { getOrgContext } from "@/lib/auth";
import { resolveFiscalYear } from "@/modules/accounting/queries";
import { getDashboard } from "@/modules/dashboard/queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Amount, EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { PairedBars, TreasuryLine } from "@/components/charts/charts";
import { cn, fmtDate, fmtDateShort, fmtMonth } from "@/lib/utils";

export const metadata = { title: "Accueil" };

function Kpi({ label, value, hint, icon: Icon, tone, featured }: { label: string; value: number; hint?: string; icon: typeof Wallet; tone?: "positive" | "negative"; featured?: boolean }) {
  return (
    <Card className={cn("relative overflow-hidden p-4", featured && "border-accent/25 bg-[linear-gradient(140deg,var(--accent-soft),var(--surface)_70%)]")}>
      <div className="flex items-center gap-2.5 text-[13px] font-medium text-muted">
        <span className={cn("grid size-7 place-items-center rounded-lg", featured ? "bg-accent text-white shadow-sm" : tone === "positive" ? "bg-positive-soft text-positive" : tone === "negative" ? "bg-negative-soft text-negative" : "bg-surface-2 text-muted")}>
          <Icon className="size-3.5" />
        </span>
        {label}
      </div>
      <div className="mt-3 text-[26px] leading-none font-semibold tracking-[-0.03em] tabular">{formatEUR(value)}</div>
      <div className="mt-2 min-h-4 text-xs text-muted">{hint}</div>
    </Card>
  );
}

const SEVERITY = {
  critical: { icon: OctagonAlert, className: "text-negative bg-negative-soft" },
  warning: { icon: AlertTriangle, className: "text-warning bg-warning-soft" },
  info: { icon: Info, className: "text-accent bg-accent-soft" },
};

export default async function Dashboard({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<{ bienvenue?: string }> }) {
  const { org: slug } = await params;
  const { bienvenue } = await searchParams;
  const { org, canWrite } = await getOrgContext(slug);
  const fy = await resolveFiscalYear(org.id);
  const d = await getDashboard(org.id, fy);
  const base = `/app/${slug}`;

  const checklist = [
    { done: d.checklist.hasImport, label: "Importer un premier relevé bancaire", href: `${base}/banque?action=importer` },
    { done: d.checklist.hasMembers, label: "Ajouter vos adhérents", href: `${base}/adherents?action=ajouter` },
    { done: d.checklist.hasDocuments, label: "Déposer un justificatif", href: `${base}/justificatifs?action=ajouter` },
    { done: d.checklist.hasTeam, label: "Inviter un membre du bureau", href: `${base}/parametres?onglet=equipe` },
  ];
  const showChecklist = canWrite && (bienvenue || checklist.some((c) => !c.done));
  const hasActivity = d.flows.some((f) => f.income || f.expense);

  const lastActual = d.flows.length ? d.treasury.total : 0;
  const treasurySeries = [
    { label: "Auj.", actual: lastActual, projected: lastActual },
    ...d.forecast.map((p) => ({ label: fmtMonth(p.month), actual: null, projected: p.projectedBalance })),
  ];

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] text-muted">{fy.label} · du {fmtDate(fy.start_date)} au {fmtDate(fy.end_date)}</p>
          <h1 className="mt-1 text-[24px] font-semibold tracking-[-0.025em] text-balance">Bonjour, voici la situation de {org.name}</h1>
        </div>
        {canWrite && d.pendingTx > 0 && (
          <Button asChild variant="primary">
            <Link href={`${base}/banque`}>
              {d.pendingTx} mouvement{d.pendingTx > 1 ? "s" : ""} à catégoriser <ArrowRight />
            </Link>
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi featured label="Trésorerie disponible" value={d.treasury.total} icon={Wallet} hint={`${d.treasury.accounts.length} compte(s) bancaire(s) et caisse`} />
        <Kpi label="Recettes de l'exercice" value={d.income} icon={ArrowUpRight} tone="positive" hint="Opérations comptabilisées" />
        <Kpi label="Dépenses de l'exercice" value={d.expense} icon={ArrowDownRight} tone="negative" hint="Opérations comptabilisées" />
        <Kpi label={d.result >= 0 ? "Excédent" : "Déficit"} value={d.result} icon={d.result >= 0 ? ArrowUpRight : ArrowDownRight} tone={d.result >= 0 ? "positive" : "negative"} hint={d.unpaidFees.count ? `${formatEUR(d.unpaidFees.total)} de cotisations à encaisser` : undefined} />
      </div>

      {showChecklist && (() => {
        const done = checklist.filter((c) => c.done).length;
        return (
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Bien démarrer</CardTitle>
                <CardDescription>Quatre étapes pour une comptabilité complète.</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-surface-2 sm:block" role="progressbar" aria-valuemin={0} aria-valuemax={4} aria-valuenow={done} aria-label="Progression">
                  <div className="h-full rounded-full bg-positive transition-[width]" style={{ width: `${(done / 4) * 100}%` }} />
                </div>
                <span className="text-xs font-medium text-muted tabular">{done}/4</span>
              </div>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {checklist.map((c, i) => (
                <Link
                  key={c.label}
                  href={c.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-[13px] transition-colors",
                    c.done ? "border-transparent bg-surface-2/70 text-muted" : "border-border hover:border-accent/40 hover:bg-accent-soft/40",
                  )}
                >
                  {c.done ? (
                    <CheckCircle2 className="size-[18px] shrink-0 text-positive" />
                  ) : (
                    <span className="grid size-[18px] shrink-0 place-items-center rounded-full border border-border-strong text-[10px] font-semibold text-muted tabular">{i + 1}</span>
                  )}
                  <span className={cn("flex-1 font-medium", c.done && "font-normal line-through decoration-border-strong")}>{c.label}</span>
                  {!c.done && <ArrowRight className="size-3.5 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />}
                </Link>
              ))}
            </CardContent>
          </Card>
        );
      })()}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Recettes et dépenses</CardTitle>
              <CardDescription>12 derniers mois, opérations comptabilisées</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {hasActivity ? (
              <PairedBars
                data={d.flows.map((f) => ({ mois: fmtMonth(f.month), recettes: f.income, depenses: f.expense }))}
                xKey="mois"
                series={[{ key: "recettes", label: "Recettes" }, { key: "depenses", label: "Dépenses" }]}
              />
            ) : (
              <EmptyState icon={ArrowUpRight} title="Aucune opération pour l'instant" description="Importez un relevé bancaire : vos recettes et dépenses apparaîtront ici." action={canWrite && <Button asChild variant="primary"><Link href={`${base}/banque?action=importer`}>Importer un relevé</Link></Button>} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Alertes</CardTitle>
              <CardDescription>Contrôles automatiques</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-2">
            {d.anomalies.length === 0 ? (
              <div className="flex items-center gap-2.5 rounded-lg bg-positive-soft px-3 py-3 text-[13px] text-positive">
                <CheckCircle2 className="size-4" /> Tout est en ordre.
              </div>
            ) : (
              d.anomalies.slice(0, 5).map((a, i) => {
                const S = SEVERITY[a.severity];
                return (
                  <Link key={i} href={a.code === "missing_receipt" ? `${base}/justificatifs` : `${base}/banque`} className="flex gap-2.5 rounded-lg px-2 py-2 hover:bg-surface-2">
                    <span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-md", S.className)}><S.icon className="size-3.5" /></span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium">{a.title}</span>
                      <span className="block text-xs text-muted">{a.detail}</span>
                    </span>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Prévisionnel de trésorerie</CardTitle>
              <CardDescription>6 mois : tendance des 6 derniers mois et cotisations attendues</CardDescription>
            </div>
            {d.forecast.length > 0 && (
              <div className="text-right">
                <div className="text-xs text-muted">Dans 6 mois</div>
                <div className={cn("text-sm font-semibold tabular", d.forecast.at(-1)!.projectedBalance < 0 && "text-negative")}>{formatEUR(d.forecast.at(-1)!.projectedBalance)}</div>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {hasActivity ? <TreasuryLine data={treasurySeries} /> : <p className="py-10 text-center text-[13px] text-muted">La projection s&apos;affichera après vos premières opérations.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Échéancier</CardTitle>
              <CardDescription>120 prochains jours</CardDescription>
            </div>
            <CalendarDays className="size-4 text-subtle" />
          </CardHeader>
          <CardContent>
            {d.calendar.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-muted">Aucune échéance à venir.</p>
            ) : (
              <ul className="grid gap-1.5">
                {d.calendar.map((c, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-lg px-1 py-1.5">
                    <span className="relative grid w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-surface text-center shadow-xs">
                      <span className={cn("h-1", c.kind === "fee" ? "bg-chart-1" : c.kind === "fiscal" ? "bg-negative" : "bg-chart-2")} />
                      <span className="py-1 text-[11px] leading-tight font-semibold tabular">{fmtDateShort(c.date)}</span>
                    </span>
                    <span className="min-w-0 truncate text-[13px] font-medium">{c.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dernières opérations</CardTitle>
          <Link href={`${base}/operations`} className="inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-foreground">Tout voir <ArrowRight className="size-3.5" /></Link>
        </CardHeader>
        {d.recent.length ? (
          <ul className="divide-y divide-border border-t border-border">
            {d.recent.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-5 py-2.5 text-[13px] transition-colors hover:bg-surface-2/50">
                <span className={cn("grid size-7 shrink-0 place-items-center rounded-full", e.amount >= 0 ? "bg-positive-soft text-positive" : "bg-surface-2 text-muted")}>
                  {e.amount >= 0 ? <ArrowDownLeft className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{e.label}</span>
                <span className="hidden w-16 shrink-0 text-right text-xs text-muted tabular sm:block">{fmtDateShort(e.date)}</span>
                <Amount cents={e.amount} signed colored className="w-28 text-right font-semibold" />
              </li>
            ))}
          </ul>
        ) : (
          <CardContent><p className="text-[13px] text-muted">Aucune opération comptabilisée.</p></CardContent>
        )}
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {d.treasury.accounts.map((a) => (
          <div key={a.number} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-xs">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted"><Landmark className="size-4" /></span>
            <div className="min-w-0">
              <div className="truncate text-xs text-muted">{a.label}</div>
              <div className="mt-0.5 text-sm font-semibold tabular">{formatEUR(a.balance)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
