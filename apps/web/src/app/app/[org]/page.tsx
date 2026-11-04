import Link from "next/link";
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, CheckCircle2, Circle, Info, OctagonAlert, Wallet } from "lucide-react";
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

function Kpi({ label, value, hint, icon: Icon, tone }: { label: string; value: number; hint?: string; icon: typeof Wallet; tone?: "positive" | "negative" }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between text-[13px] text-muted">
        {label}
        <Icon className={cn("size-4", tone === "positive" ? "text-positive" : tone === "negative" ? "text-negative" : "text-subtle")} />
      </div>
      <div className="mt-2 text-[22px] font-semibold tracking-[-0.02em] tabular">{formatEUR(value)}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
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
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] text-muted">{fy.label} · du {fmtDate(fy.start_date)} au {fmtDate(fy.end_date)}</p>
          <h1 className="mt-0.5 text-[22px] font-semibold tracking-[-0.02em]">Bonjour, voici la situation de {org.name}</h1>
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
        <Kpi label="Trésorerie disponible" value={d.treasury.total} icon={Wallet} hint={`${d.treasury.accounts.length} compte(s) bancaire(s) et caisse`} />
        <Kpi label="Recettes de l'exercice" value={d.income} icon={ArrowUpRight} tone="positive" />
        <Kpi label="Dépenses de l'exercice" value={d.expense} icon={ArrowDownRight} tone="negative" />
        <Kpi label={d.result >= 0 ? "Excédent" : "Déficit"} value={d.result} icon={d.result >= 0 ? ArrowUpRight : ArrowDownRight} tone={d.result >= 0 ? "positive" : "negative"} hint={d.unpaidFees.count ? `${formatEUR(d.unpaidFees.total)} de cotisations à encaisser` : undefined} />
      </div>

      {showChecklist && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Bien démarrer</CardTitle>
              <CardDescription>Quatre étapes pour une comptabilité complète.</CardDescription>
            </div>
            <span className="text-xs text-muted tabular">{checklist.filter((c) => c.done).length}/4</span>
          </CardHeader>
          <CardContent className="grid gap-1 sm:grid-cols-2">
            {checklist.map((c) => (
              <Link key={c.label} href={c.href} className="flex items-center gap-2.5 rounded-md px-2 py-2 text-[13px] hover:bg-surface-2">
                {c.done ? <CheckCircle2 className="size-4 text-positive" /> : <Circle className="size-4 text-subtle" />}
                <span className={cn(c.done && "text-muted line-through")}>{c.label}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
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

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
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
              <ul className="grid gap-1">
                {d.calendar.map((c, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-md px-1 py-1.5">
                    <span className="w-14 shrink-0 text-xs font-medium text-muted tabular">{fmtDateShort(c.date)}</span>
                    <span className={cn("size-1.5 shrink-0 rounded-full", c.kind === "fee" ? "bg-chart-1" : c.kind === "fiscal" ? "bg-negative" : "bg-chart-2")} />
                    <span className="truncate text-[13px]">{c.title}</span>
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
          <Link href={`${base}/operations`} className="text-[13px] text-muted hover:text-foreground">Tout voir</Link>
        </CardHeader>
        {d.recent.length ? (
          <ul className="divide-y divide-border border-t border-border">
            {d.recent.map((e) => (
              <li key={e.id} className="flex items-center gap-4 px-5 py-2.5 text-[13px]">
                <span className="w-16 shrink-0 text-xs text-muted tabular">{fmtDateShort(e.date)}</span>
                <span className="min-w-0 flex-1 truncate">{e.label}</span>
                <Amount cents={e.amount} signed colored className="font-medium" />
              </li>
            ))}
          </ul>
        ) : (
          <CardContent><p className="text-[13px] text-muted">Aucune opération comptabilisée.</p></CardContent>
        )}
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {d.treasury.accounts.map((a) => (
          <div key={a.number} className="rounded-lg border border-border px-4 py-3">
            <div className="truncate text-xs text-muted">{a.label}</div>
            <div className="mt-0.5 text-sm font-semibold tabular">{formatEUR(a.balance)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
