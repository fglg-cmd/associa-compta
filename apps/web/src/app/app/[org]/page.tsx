import Link from "next/link";
import { AlertTriangle, ArrowDownLeft, ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, CheckCircle2, Circle, FileText, Info, Landmark, OctagonAlert, Sparkles, Users, Wallet } from "lucide-react";
import { formatEUR } from "@associa/accounting";
import { getOrgContext } from "@/lib/auth";
import { resolveFiscalYear } from "@/modules/accounting/queries";
import { getDashboard } from "@/modules/dashboard/queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Amount, EmptyState } from "@/components/ui/misc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PairedBars, TreasuryLine } from "@/components/charts/lazy";
import { cn, fmtDate, fmtDateShort, fmtMonth, todayISO } from "@/lib/utils";

export const metadata = { title: "Accueil" };

function Kpi({ label, value, hint, icon: Icon, tone, featured }: { label: string; value: number; hint?: string; icon: typeof Wallet; tone?: "positive" | "negative"; featured?: boolean }) {
  return (
    <Card className={cn("relative min-w-0 overflow-hidden p-4", featured ? "col-span-2 border-accent/25 bg-[linear-gradient(140deg,var(--accent-soft),var(--surface)_70%)] sm:col-span-1" : "")}>
      <div className="flex items-center gap-2.5 text-[12.5px] font-medium text-muted sm:text-[13px]">
        <span className={cn("grid size-7 place-items-center rounded-lg", featured ? "bg-accent text-white shadow-sm" : tone === "positive" ? "bg-positive-soft text-positive" : tone === "negative" ? "bg-negative-soft text-negative" : "bg-surface-2 text-muted")}>
          <Icon className="size-3.5" />
        </span>
        {label}
      </div>
      <div className={cn("mt-3 leading-none font-semibold tracking-[-0.03em] tabular", featured ? "text-[26px]" : "text-[20px] sm:text-[26px]")}>{formatEUR(value)}</div>
      <div className="mt-2 min-h-4 text-xs text-muted">{hint}</div>
    </Card>
  );
}

type Task = { key: string; icon: typeof Wallet; tone: "accent" | "warning" | "negative" | "neutral"; title: string; detail?: string; href: string; cta?: string };

const TONE: Record<Task["tone"], string> = {
  accent: "bg-accent-soft text-accent",
  warning: "bg-warning-soft text-warning",
  negative: "bg-negative-soft text-negative",
  neutral: "bg-surface-2 text-muted",
};
const SEVERITY_TONE = { critical: "negative", warning: "warning", info: "accent" } as const;
const SEVERITY_ICON = { critical: OctagonAlert, warning: AlertTriangle, info: Info };

export default async function Dashboard({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<{ bienvenue?: string }> }) {
  const { org: slug } = await params;
  await searchParams;
  const { org, canWrite } = await getOrgContext(slug);
  const fy = await resolveFiscalYear(org.id);
  const d = await getDashboard(org.id, fy);
  const base = `/app/${slug}`;
  const hasActivity = d.flows.some((f) => f.income || f.expense);

  // Une seule liste « À faire » : mouvements à traiter, contrôles automatiques,
  // cotisations, échéances proches et premiers pas, par ordre d'importance.
  const tasks: Task[] = [];
  if (canWrite && d.pendingTx > 0) {
    tasks.push({ key: "pending", icon: Sparkles, tone: "accent", title: `${d.pendingTx} mouvement${d.pendingTx > 1 ? "s" : ""} à valider`, detail: "Les catégories sont déjà proposées : un clic suffit.", href: `${base}/banque`, cta: "Valider" });
  }
  for (const a of d.anomalies) {
    if (a.code === "stale_pending") continue; // déjà couvert par la ligne ci-dessus
    tasks.push({ key: a.code, icon: SEVERITY_ICON[a.severity], tone: SEVERITY_TONE[a.severity], title: a.title, detail: a.detail, href: a.code === "missing_receipt" ? `${base}/justificatifs` : `${base}/banque` });
  }
  if (d.unpaidFees.count > 0) {
    tasks.push({ key: "fees", icon: Users, tone: "warning", title: `${d.unpaidFees.count} cotisation${d.unpaidFees.count > 1 ? "s" : ""} à encaisser`, detail: `${formatEUR(d.unpaidFees.total)} au total`, href: `${base}/adherents` });
  }
  const soon = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  for (const c of d.calendar.filter((c) => c.date >= todayISO() && c.date <= soon).slice(0, 2)) {
    tasks.push({ key: `cal-${c.date}-${c.title}`, icon: CalendarDays, tone: "neutral", title: c.title, detail: `Le ${fmtDate(c.date)}`, href: c.kind === "fee" ? `${base}/adherents` : c.kind === "fiscal" ? `${base}/rapports` : `${base}/projets` });
  }
  if (canWrite) {
    const steps = [
      { done: d.checklist.hasImport, icon: Landmark, title: "Importer votre premier relevé bancaire", href: `${base}/banque?action=importer` },
      { done: d.checklist.hasMembers, icon: Users, title: "Ajouter vos adhérents", href: `${base}/adherents?action=ajouter` },
      { done: d.checklist.hasDocuments, icon: FileText, title: "Déposer un justificatif", href: `${base}/justificatifs?action=ajouter` },
      { done: d.checklist.hasTeam, icon: Users, title: "Inviter un membre du bureau", href: `${base}/parametres?onglet=equipe` },
    ];
    const next = steps.find((s) => !s.done);
    if (next) tasks.push({ key: "step", icon: Circle, tone: "neutral", title: next.title, detail: `Premiers pas · ${steps.filter((s) => s.done).length} sur 4 terminés`, href: next.href });
  }
  const shownTasks = tasks.slice(0, 5);

  const lastActual = d.flows.length ? d.treasury.total : 0;
  const treasurySeries = [
    { label: "Auj.", actual: lastActual, projected: lastActual },
    ...d.forecast.map((p) => ({ label: fmtMonth(p.month), actual: null, projected: p.projectedBalance })),
  ];
  const resultLabel = d.result >= 0 ? "Excédent" : "Déficit";

  return (
    <div className="grid grid-cols-1 gap-6">
      <div>
        <h1 className="hidden text-[26px] font-semibold tracking-[-0.03em] sm:block">{org.name}</h1>
        <p className="text-[13.5px] text-muted sm:mt-1">{fy.label} · du {fmtDate(fy.start_date)} au {fmtDate(fy.end_date)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Kpi featured label="Trésorerie disponible" value={d.treasury.total} icon={Wallet} hint={d.treasury.accounts.length > 1 ? `Sur ${d.treasury.accounts.length} comptes` : "Sur votre compte"} />
        <Kpi label="Recettes" value={d.income} icon={ArrowUpRight} tone="positive" hint="Sur l'exercice" />
        <Kpi label="Dépenses" value={d.expense} icon={ArrowDownRight} tone="negative" hint={`${resultLabel} : ${formatEUR(d.result, { signed: true })}`} />
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>À faire</CardTitle>
            <CardDescription>{shownTasks.length ? "Ce qui demande votre attention, dans l'ordre." : "Rien ne demande votre attention."}</CardDescription>
          </div>
          {tasks.length > 0 && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted tabular">{tasks.length}</span>}
        </CardHeader>
        {shownTasks.length === 0 ? (
          <CardContent>
            <div className="flex items-center gap-2.5 rounded-lg bg-positive-soft px-3 py-3 text-[13.5px] font-medium text-positive">
              <CheckCircle2 className="size-4" /> Tout est à jour. Bravo !
            </div>
          </CardContent>
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {shownTasks.map((t) => (
              <li key={t.key}>
                <Link href={t.href} className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2/50">
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", TONE[t.tone])}><t.icon className="size-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{t.title}</span>
                    {t.detail && <span className="block truncate text-[12.5px] text-muted">{t.detail}</span>}
                  </span>
                  {t.cta ? (
                    <span className="hidden rounded-md bg-accent px-2.5 py-1 text-[12.5px] font-medium text-white shadow-xs sm:inline-flex">{t.cta}</span>
                  ) : (
                    <ArrowRight className="size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Card className="min-w-0 xl:col-span-3">
          {hasActivity ? (
            <Tabs defaultValue="flux">
              <CardHeader className="flex-wrap">
                <CardTitle className="pt-1">Évolution</CardTitle>
                <TabsList>
                  <TabsTrigger value="flux">Recettes et dépenses</TabsTrigger>
                  <TabsTrigger value="tresorerie">Trésorerie prévue</TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent>
                <TabsContent value="flux">
                  <PairedBars
                    data={d.flows.map((f) => ({ mois: fmtMonth(f.month), recettes: f.income, depenses: f.expense }))}
                    xKey="mois"
                    series={[{ key: "recettes", label: "Recettes" }, { key: "depenses", label: "Dépenses" }]}
                  />
                </TabsContent>
                <TabsContent value="tresorerie">
                  <TreasuryLine data={treasurySeries} />
                  {d.forecast.length > 0 && (
                    <p className="mt-3 text-[12.5px] text-muted">Estimation dans 6 mois : <strong className={cn("font-semibold text-foreground tabular", d.forecast.at(-1)!.projectedBalance < 0 && "text-negative")}>{formatEUR(d.forecast.at(-1)!.projectedBalance)}</strong>, d&apos;après vos 6 derniers mois et les cotisations attendues.</p>
                  )}
                </TabsContent>
              </CardContent>
            </Tabs>
          ) : (
            <EmptyState icon={ArrowUpRight} title="Vos graphiques apparaîtront ici" description="Importez un relevé bancaire : vos recettes et dépenses s'afficheront automatiquement." action={canWrite && <Button asChild variant="primary"><Link href={`${base}/banque?action=importer`}>Importer un relevé</Link></Button>} />
          )}
        </Card>

        <Card className="min-w-0 xl:col-span-2">
          <CardHeader>
            <CardTitle>Derniers mouvements</CardTitle>
            <Link href={`${base}/banque?vue=all`} className="inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-foreground">Tout voir <ArrowRight className="size-3.5" /></Link>
          </CardHeader>
          {d.recent.length ? (
            <ul className="divide-y divide-border border-t border-border">
              {d.recent.slice(0, 6).map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-5 py-2.5 text-[13px]">
                  <span className={cn("grid size-7 shrink-0 place-items-center rounded-full", e.amount >= 0 ? "bg-positive-soft text-positive" : "bg-surface-2 text-muted")}>
                    {e.amount >= 0 ? <ArrowDownLeft className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{e.label}</span>
                    <span className="block text-xs text-muted tabular">{fmtDateShort(e.date)}</span>
                  </span>
                  <Amount cents={e.amount} signed colored className="font-semibold" />
                </li>
              ))}
            </ul>
          ) : (
            <CardContent><p className="text-[13px] text-muted">Aucun mouvement pour l&apos;instant.</p></CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
