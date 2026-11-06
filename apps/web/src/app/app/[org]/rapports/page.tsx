import Link from "next/link";
import { Download, FileSpreadsheet, FileText, Table2 } from "lucide-react";
import type { StatementSection } from "@associa/accounting";
import { getOrgContext } from "@/lib/auth";
import { features } from "@/lib/env";
import { getFiscalYears, getStatements, resolveFiscalYear } from "@/modules/accounting/queries";
import { PageHeader, Amount } from "@/components/ui/misc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FiscalYearPicker } from "@/components/finance/fiscal-year-picker";
import { cn, fmtDate } from "@/lib/utils";
import { AgReport } from "./ag-report";

export const metadata = { title: "Rapports" };

function Section({ s, total }: { s: StatementSection; total?: boolean }) {
  return (
    <div className="mb-4">
      <div className="flex justify-between border-b border-border pb-1.5 text-[13px] font-semibold"><span>{s.label}</span>{total !== false && <Amount cents={s.total} />}</div>
      {s.lines.filter((l) => l.amount !== 0).map((l) => (
        <details key={l.key} className="group border-b border-border/60 text-[13px]">
          <summary className="flex cursor-pointer list-none justify-between py-1.5 pl-3 hover:bg-surface-2/60"><span>{l.label}</span><Amount cents={l.amount} /></summary>
          <div className="pb-2 pl-6">
            {l.details.map((d) => <div key={d.number} className="flex justify-between py-0.5 text-xs text-muted"><span><span className="font-mono">{d.number}</span> {d.label}</span><Amount cents={d.amount} /></div>)}
          </div>
        </details>
      ))}
      {s.lines.every((l) => l.amount === 0) && <p className="py-2 pl-3 text-xs text-subtle">Néant</p>}
    </div>
  );
}

/** Répartition lisible d'une section (« d'où vient l'argent », « où va l'argent »). */
function Breakdown({ title, s, color, empty }: { title: string; s: StatementSection; color: string; empty: string }) {
  const lines = s.lines.filter((l) => l.amount > 0).sort((a, b) => b.amount - a.amount);
  const max = lines[0]?.amount ?? 0;
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle><span className="text-[13px] font-semibold tabular"><Amount cents={s.total} /></span></CardHeader>
      <CardContent>
        {lines.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted">{empty}</p>
        ) : (
          <ul className="grid gap-3">
            {lines.slice(0, 6).map((l) => (
              <li key={l.key}>
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="truncate">{l.label}</span>
                  <span className="shrink-0 font-medium tabular"><Amount cents={l.amount} /> <span className="ml-1 text-xs font-normal text-muted">{s.total ? Math.round((l.amount / s.total) * 100) : 0} %</span></span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full" style={{ width: `${max ? Math.max(3, (l.amount / max) * 100) : 0}%`, background: color }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

const Row = ({ label, value, strong }: { label: string; value: number; strong?: boolean }) => (
  <div className={cn("flex justify-between py-1.5 text-[13px]", strong && "border-t border-border font-semibold")}><span>{label}</span><Amount cents={value} /></div>
);

export default async function ReportsPage({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<{ exercice?: string; onglet?: string }> }) {
  const { org: slug } = await params;
  const sp = await searchParams;
  const { org, canWrite } = await getOrgContext(slug);
  const [fy, years] = await Promise.all([resolveFiscalYear(org.id, sp.exercice), getFiscalYears(org.id)]);
  const st = await getStatements(org.id, fy);
  // « ag » (ancien onglet) mène au résumé, qui contient la préparation de l'AG.
  const tab = ["resultat", "bilan", "exports"].includes(sp.onglet ?? "") ? sp.onglet! : "resume";
  const is = st.income;
  const bs = st.balance;
  const ex = (r: string, f: string) => `/api/exports/${org.id}?rapport=${r}&format=${f}&exercice=${fy.id}`;
  const link = (t: string) => `/app/${slug}/rapports?onglet=${t}${sp.exercice ? `&exercice=${sp.exercice}` : ""}`;

  const exportGroups: { title: string; items: string[] }[] = [
    { title: "Pour l'assemblée générale", items: ["ag", "compte-resultat", "bilan", "adherents"] },
    { title: "Pour l'expert-comptable", items: ["balance", "grand-livre", "journal", "fec"] },
  ];
  const exports = [
    { r: "compte-resultat", t: "Compte de résultat", d: "Présentation ANC 2018-06", f: ["pdf", "xlsx", "csv"] },
    { r: "bilan", t: "Bilan", d: "Actif et passif à la clôture", f: ["pdf", "xlsx", "csv"] },
    { r: "ag", t: "Comptes annuels pour l'AG", d: "Compte de résultat + bilan + chiffres clés", f: ["pdf", "xlsx"] },
    { r: "balance", t: "Balance générale", d: "Tous les comptes mouvementés", f: ["pdf", "xlsx", "csv"] },
    { r: "grand-livre", t: "Grand livre", d: "Détail des écritures par compte", f: ["pdf", "xlsx", "csv"] },
    { r: "journal", t: "Journal général", d: "Toutes les écritures par journal", f: ["pdf", "xlsx", "csv"] },
    { r: "fec", t: "Fichier des écritures comptables", d: "Format FEC de l'administration fiscale", f: ["txt"] },
    { r: "adherents", t: "Liste des adhérents", d: "Coordonnées et adhésions", f: ["xlsx", "csv", "pdf"] },
  ];

  return (
    <>
      <PageHeader title="Rapports" description={`${fy.label} · du ${fmtDate(fy.start_date)} au ${fmtDate(fy.end_date)}${fy.status === "open" ? " · exercice en cours" : ""}`} actions={<FiscalYearPicker years={years} current={fy.id} />}>
        <div className="flex flex-wrap gap-1 border-b border-border">
          {[["resume", "Résumé"], ["resultat", "Compte de résultat"], ["bilan", "Bilan"], ["exports", "Téléchargements"]].map(([k, l]) => (
            <Link key={k} href={k === "resume" ? `/app/${slug}/rapports${sp.exercice ? `?exercice=${sp.exercice}` : ""}` : link(k!)} className={cn("-mb-px border-b-2 px-3 py-2 text-[13px] font-medium", tab === k ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground")}>{l}</Link>
          ))}
        </div>
      </PageHeader>

      {tab === "resume" && (
        <div className="grid gap-6">
          <Card className="grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="p-5"><div className="text-[13px] text-muted">Recettes</div><div className="mt-1 text-[24px] font-semibold tracking-[-0.025em]"><Amount cents={is.totalIncome} /></div></div>
            <div className="p-5"><div className="text-[13px] text-muted">Dépenses</div><div className="mt-1 text-[24px] font-semibold tracking-[-0.025em]"><Amount cents={is.totalExpenses} /></div></div>
            <div className="p-5">
              <div className="text-[13px] text-muted">{is.netResult >= 0 ? "Excédent" : "Déficit"}</div>
              <div className={cn("mt-1 text-[24px] font-semibold tracking-[-0.025em]", is.netResult >= 0 ? "text-positive" : "text-negative")}><Amount cents={is.netResult} signed /></div>
            </div>
          </Card>
          <div className="grid gap-6 lg:grid-cols-2">
            <Breakdown title="D'où vient l'argent" s={is.operatingIncome} color="var(--chart-1)" empty="Aucune recette sur cet exercice." />
            <Breakdown title="Où va l'argent" s={is.operatingExpenses} color="var(--chart-2)" empty="Aucune dépense sur cet exercice." />
          </div>
          <Card>
            <CardHeader><div><CardTitle>Préparer l&apos;assemblée générale</CardTitle><CardDescription>{features.ai ? <>L&apos;assistant peut rédiger un premier jet du rapport du trésorier. Relisez-le, puis téléchargez le dossier complet (rapport, compte de résultat, bilan).</> : <>Rédigez le rapport du trésorier (facultatif), puis téléchargez le dossier complet : compte de résultat, bilan et chiffres clés.</>}</CardDescription></div></CardHeader>
            <CardContent><AgReport orgId={org.id} fiscalYearId={fy.id} aiEnabled={features.ai && canWrite} /></CardContent>
          </Card>
        </div>
      )}

      {tab === "resultat" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <Card><CardContent className="pt-5">
            <Section s={is.operatingIncome} />
            <Section s={is.operatingExpenses} />
            <Row label="Résultat d'exploitation" value={is.operatingResult} strong />
            <Row label="Résultat financier" value={is.financialResult} />
            <Row label="Résultat exceptionnel" value={is.exceptionalResult} />
            {is.incomeTax !== 0 && <Row label="Impôts sur les bénéfices" value={-is.incomeTax} />}
            <div className={cn("mt-2 flex justify-between rounded-lg px-3 py-2.5 text-sm font-semibold", is.netResult >= 0 ? "bg-positive-soft text-positive" : "bg-negative-soft text-negative")}>
              <span>{is.netResult >= 0 ? "Excédent de l'exercice" : "Déficit de l'exercice"}</span><Amount cents={is.netResult} />
            </div>
            {(is.inKind.contributions !== 0 || is.inKind.uses !== 0) && (
              <div className="mt-5"><div className="mb-1 text-[13px] font-semibold">Contributions volontaires en nature</div><Row label="Contributions reçues" value={is.inKind.contributions} /><Row label="Emplois" value={is.inKind.uses} /></div>
            )}
          </CardContent></Card>
          <div className="grid content-start gap-3">
            <Card className="p-4"><div className="text-[13px] text-muted">Total des produits</div><div className="mt-1 text-xl font-semibold"><Amount cents={is.totalIncome} /></div></Card>
            <Card className="p-4"><div className="text-[13px] text-muted">Total des charges</div><div className="mt-1 text-xl font-semibold"><Amount cents={is.totalExpenses} /></div></Card>
            <a href={ex("compte-resultat", "pdf")} className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-accent px-3 text-sm font-medium text-accent-foreground hover:bg-accent-hover"><Download className="size-4" /> Télécharger en PDF</a>
          </div>
        </div>
      )}

      {tab === "bilan" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card><CardHeader><CardTitle>Actif</CardTitle></CardHeader><CardContent>{bs.assets.map((s) => <Section key={s.key} s={s} />)}<Row label="TOTAL ACTIF" value={bs.totalAssets} strong /></CardContent></Card>
          <Card><CardHeader><CardTitle>Passif</CardTitle>{bs.balanced ? <Badge tone="positive">Équilibré</Badge> : <Badge tone="negative">Déséquilibré</Badge>}</CardHeader><CardContent>{bs.liabilities.map((s) => <Section key={s.key} s={s} />)}<Row label="TOTAL PASSIF" value={bs.totalLiabilities} strong /></CardContent></Card>
        </div>
      )}

      {tab === "exports" && (
        <div className="grid gap-8">
          {exportGroups.map((g) => (
            <section key={g.title}>
              <h2 className="mb-3 text-[13px] font-semibold text-muted">{g.title}</h2>
              <Card className="divide-y divide-border overflow-hidden">
                {g.items.map((key) => {
                  const e = exports.find((x) => x.r === key)!;
                  const [main, ...others] = e.f;
                  return (
                    <div key={e.r} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-surface-2">{e.f.includes("pdf") ? <FileText className="size-4 text-muted" /> : e.r === "fec" ? <Table2 className="size-4 text-muted" /> : <FileSpreadsheet className="size-4 text-muted" />}</span>
                      <div className="min-w-0 flex-1"><div className="text-[13.5px] font-medium">{e.t}</div><div className="text-xs text-muted">{e.d}</div></div>
                      <div className="flex items-center gap-2">
                        {others.map((f) => <a key={f} href={ex(e.r, f)} className="text-xs font-medium uppercase text-muted hover:text-foreground">{f}</a>)}
                        <a href={ex(e.r, main!)} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-[13px] font-medium shadow-xs hover:bg-surface-2"><Download className="size-3.5" /> {main === "txt" ? "FEC" : main!.toUpperCase()}</a>
                      </div>
                    </div>
                  );
                })}
              </Card>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
