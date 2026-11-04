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

const Row = ({ label, value, strong }: { label: string; value: number; strong?: boolean }) => (
  <div className={cn("flex justify-between py-1.5 text-[13px]", strong && "border-t border-border font-semibold")}><span>{label}</span><Amount cents={value} /></div>
);

export default async function ReportsPage({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<{ exercice?: string; onglet?: string }> }) {
  const { org: slug } = await params;
  const sp = await searchParams;
  const { org, canWrite } = await getOrgContext(slug);
  const [fy, years] = await Promise.all([resolveFiscalYear(org.id, sp.exercice), getFiscalYears(org.id)]);
  const st = await getStatements(org.id, fy);
  const tab = ["resultat", "bilan", "ag", "exports"].includes(sp.onglet ?? "") ? sp.onglet! : "resultat";
  const is = st.income;
  const bs = st.balance;
  const ex = (r: string, f: string) => `/api/exports/${org.id}?rapport=${r}&format=${f}&exercice=${fy.id}`;
  const link = (t: string) => `/app/${slug}/rapports?onglet=${t}${sp.exercice ? `&exercice=${sp.exercice}` : ""}`;

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
          {[["resultat", "Compte de résultat"], ["bilan", "Bilan"], ["ag", "Assemblée générale"], ["exports", "Exports"]].map(([k, l]) => (
            <Link key={k} href={link(k!)} className={cn("-mb-px border-b-2 px-3 py-2 text-[13px] font-medium", tab === k ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground")}>{l}</Link>
          ))}
        </div>
      </PageHeader>

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

      {tab === "ag" && (
        <Card>
          <CardHeader><div><CardTitle>Rapport financier de l&apos;assemblée générale</CardTitle><CardDescription>L&apos;assistant rédige un premier jet à partir de vos comptes ; relisez-le, modifiez-le, puis téléchargez le dossier PDF complet.</CardDescription></div></CardHeader>
          <CardContent><AgReport orgId={org.id} fiscalYearId={fy.id} aiEnabled={features.ai && canWrite} /></CardContent>
        </Card>
      )}

      {tab === "exports" && (
        <div className="grid gap-3 md:grid-cols-2">
          {exports.map((e) => (
            <Card key={e.r} className="flex items-center gap-4 p-4">
              <span className="grid size-9 place-items-center rounded-lg bg-surface-2 border border-border">{e.f.includes("pdf") ? <FileText className="size-4 text-muted" /> : e.r === "fec" ? <Table2 className="size-4 text-muted" /> : <FileSpreadsheet className="size-4 text-muted" />}</span>
              <div className="min-w-0 flex-1"><div className="text-[13px] font-medium">{e.t}</div><div className="text-xs text-muted">{e.d}</div></div>
              <div className="flex gap-1">{e.f.map((f) => <a key={f} href={ex(e.r, f)} className="rounded-md border border-border px-2 py-1 text-xs font-medium uppercase hover:bg-surface-2">{f === "txt" ? "FEC" : f}</a>)}</div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
