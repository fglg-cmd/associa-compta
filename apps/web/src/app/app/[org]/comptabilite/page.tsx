import Link from "next/link";
import { buildLedger } from "@associa/accounting";
import { getOrgContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAccounts, getFiscalYears, getJournals, getTrialBalance, resolveFiscalYear } from "@/modules/accounting/queries";
import { PageHeader, Amount } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FiscalYearPicker } from "@/components/finance/fiscal-year-picker";
import { cn, fmtDate, fmtDateNum } from "@/lib/utils";
import { AccountsManager, FiscalYearActions } from "./client";

export const metadata = { title: "Comptabilité" };

const TABS = [
  { k: "balance", l: "Balance" },
  { k: "grand-livre", l: "Grand livre" },
  { k: "journaux", l: "Journaux" },
  { k: "plan", l: "Plan comptable" },
  { k: "exercices", l: "Exercices" },
];

export default async function AccountingPage({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<{ onglet?: string; exercice?: string; compte?: string; journal?: string }> }) {
  const { org: slug } = await params;
  const sp = await searchParams;
  const { org, canWrite } = await getOrgContext(slug);
  const tab = TABS.find((t) => t.k === sp.onglet)?.k ?? "balance";
  const [fy, years, accounts, journals] = await Promise.all([resolveFiscalYear(org.id, sp.exercice), getFiscalYears(org.id), getAccounts(org.id), getJournals(org.id)]);
  const supabase = await createClient();
  const base = `/app/${slug}/comptabilite`;
  const link = (p: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ onglet: tab, exercice: sp.exercice, ...p })) if (v) u.set(k, v);
    return `${base}?${u}`;
  };
  const exportLink = (report: string, format: string) => `/api/exports/${org.id}?rapport=${report}&format=${format}&exercice=${fy.id}`;

  let content: React.ReactNode = null;

  if (tab === "balance") {
    const rows = await getTrialBalance(org.id, fy.start_date, fy.end_date);
    const td = rows.reduce((t, r) => t + r.debit, 0);
    const tc = rows.reduce((t, r) => t + r.credit, 0);
    content = (
      <Card className="overflow-hidden">
        <table className="w-full text-[13px] tabular">
          <thead className="border-b border-border text-left text-xs text-muted"><tr><th className="py-2 pl-5 font-medium">Compte</th><th className="font-medium">Intitulé</th><th className="text-right font-medium">Débit</th><th className="text-right font-medium">Crédit</th><th className="text-right font-medium">Solde débiteur</th><th className="pr-5 text-right font-medium">Solde créditeur</th></tr></thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const s = r.debit - r.credit;
              return (
                <tr key={r.account_id} className="hover:bg-surface-2/60">
                  <td className="py-2 pl-5 font-mono text-xs"><Link href={link({ onglet: "grand-livre", compte: r.account_id })} className="hover:text-accent">{r.number}</Link></td>
                  <td>{r.label}</td>
                  <td className="text-right"><Amount cents={r.debit} /></td>
                  <td className="text-right"><Amount cents={r.credit} /></td>
                  <td className="text-right">{s > 0 ? <Amount cents={s} /> : ""}</td>
                  <td className="pr-5 text-right">{s < 0 ? <Amount cents={-s} /> : ""}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t border-border bg-surface-2 font-semibold"><tr><td className="py-2 pl-5" colSpan={2}>Totaux {td === tc ? <Badge tone="positive" className="ml-2">Équilibrée</Badge> : <Badge tone="negative" className="ml-2">Déséquilibrée</Badge>}</td><td className="text-right"><Amount cents={td} /></td><td className="text-right"><Amount cents={tc} /></td><td colSpan={2} /></tr></tfoot>
        </table>
        {!rows.length && <p className="p-8 text-center text-[13px] text-muted">Aucune écriture validée sur cet exercice.</p>}
      </Card>
    );
  }

  if (tab === "grand-livre") {
    let q = supabase.from("v_ledger_lines").select("account_number, account_label, date, journal_code, entry_number, label, debit, credit").eq("organization_id", org.id).eq("fiscal_year_id", fy.id).eq("status", "posted");
    if (sp.compte) q = q.eq("account_id", sp.compte);
    const { data } = await q.order("account_number").order("date").limit(5000);
    const ledger = buildLedger(((data ?? []) as Record<string, unknown>[]).map((l) => ({
      accountNumber: l.account_number as string, accountLabel: l.account_label as string, date: l.date as string, journalCode: l.journal_code as string,
      entryNumber: l.entry_number as number | null, label: l.label as string, debit: Number(l.debit), credit: Number(l.credit),
    })));
    content = (
      <div className="grid gap-4">
        <form action={base} className="flex gap-2">
          <input type="hidden" name="onglet" value="grand-livre" />
          {sp.exercice && <input type="hidden" name="exercice" value={sp.exercice} />}
          <select name="compte" defaultValue={sp.compte ?? ""} className="h-8 rounded-md border border-border bg-surface px-2 text-sm">
            <option value="">Tous les comptes mouvementés</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.number} · {a.label}</option>)}
          </select>
          <button className="h-8 rounded-md border border-border bg-surface px-3 text-[13px] font-medium shadow-xs">Afficher</button>
        </form>
        {ledger.length === 0 && <Card className="p-8 text-center text-[13px] text-muted">Aucun mouvement.</Card>}
        {ledger.map((acc) => (
          <Card key={acc.number} className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-2.5"><span className="text-[13px] font-semibold"><span className="font-mono">{acc.number}</span> · {acc.label}</span><span className="text-[13px] tabular">Solde : <strong><Amount cents={acc.balance} /></strong></span></div>
            <table className="w-full text-xs tabular">
              <tbody className="divide-y divide-border">
                {acc.lines.map((l, i) => (
                  <tr key={i}><td className="w-24 py-1.5 pl-5 text-muted">{fmtDateNum(l.date)}</td><td className="w-24 font-mono text-muted">{l.journalCode}{l.entryNumber ? `-${l.entryNumber}` : ""}</td><td>{l.label}</td><td className="w-28 text-right">{l.debit ? <Amount cents={l.debit} /> : ""}</td><td className="w-28 text-right">{l.credit ? <Amount cents={l.credit} /> : ""}</td><td className="w-32 pr-5 text-right text-muted"><Amount cents={l.balance} /></td></tr>
                ))}
              </tbody>
              <tfoot className="border-t border-border bg-surface-2 font-semibold"><tr><td colSpan={3} className="py-1.5 pl-5">Total</td><td className="text-right"><Amount cents={acc.totalDebit} /></td><td className="text-right"><Amount cents={acc.totalCredit} /></td><td /></tr></tfoot>
            </table>
          </Card>
        ))}
      </div>
    );
  }

  if (tab === "journaux") {
    const jid = sp.journal ?? journals[0]?.id;
    const { data } = await supabase.from("v_ledger_lines").select("entry_id, date, entry_number, account_number, account_label, label, debit, credit").eq("organization_id", org.id).eq("fiscal_year_id", fy.id).eq("journal_id", jid).eq("status", "posted").order("date").order("entry_number").order("line_no").limit(5000);
    const lines = (data ?? []) as Record<string, unknown>[];
    const td = lines.reduce((t, l) => t + Number(l.debit), 0);
    content = (
      <div className="grid gap-3">
        <div className="inline-flex flex-wrap gap-1">
          {journals.map((j) => <Link key={j.id} href={link({ journal: j.id })} className={cn("rounded-full border px-3 py-1 text-[13px]", j.id === jid ? "border-foreground bg-foreground text-background" : "border-border text-muted")}>{j.code} · {j.label}</Link>)}
        </div>
        <Card className="overflow-hidden">
          <table className="w-full text-xs tabular">
            <thead className="border-b border-border text-left text-muted"><tr><th className="py-2 pl-5 font-medium">Date</th><th className="font-medium">N°</th><th className="font-medium">Compte</th><th className="font-medium">Libellé</th><th className="text-right font-medium">Débit</th><th className="pr-5 text-right font-medium">Crédit</th></tr></thead>
            <tbody className="divide-y divide-border">
              {lines.map((l, i) => (
                <tr key={i}><td className="py-1.5 pl-5 text-muted">{fmtDateNum(l.date as string)}</td><td className="font-mono">{l.entry_number as number}</td><td className="font-mono">{l.account_number as string}</td><td>{l.label as string}</td><td className="text-right">{Number(l.debit) ? <Amount cents={Number(l.debit)} /> : ""}</td><td className="pr-5 text-right">{Number(l.credit) ? <Amount cents={Number(l.credit)} /> : ""}</td></tr>
              ))}
            </tbody>
            <tfoot className="border-t border-border bg-surface-2 font-semibold"><tr><td colSpan={4} className="py-1.5 pl-5">Total</td><td className="text-right"><Amount cents={td} /></td><td className="pr-5 text-right"><Amount cents={td} /></td></tr></tfoot>
          </table>
          {!lines.length && <p className="p-8 text-center text-[13px] text-muted">Journal vide sur cet exercice.</p>}
        </Card>
      </div>
    );
  }

  if (tab === "plan") {
    content = <AccountsManager orgId={org.id} canWrite={canWrite} accounts={accounts.map((a) => ({ id: a.id, number: a.number, label: a.label, is_active: a.is_active, is_system: a.is_system }))} />;
  }

  if (tab === "exercices") {
    const { count: drafts } = await supabase.from("journal_entries").select("*", { count: "exact", head: true }).eq("fiscal_year_id", fy.id).eq("status", "draft");
    const { count: pending } = await supabase.from("bank_transactions").select("*", { count: "exact", head: true }).eq("organization_id", org.id).eq("status", "pending").gte("date", fy.start_date).lte("date", fy.end_date);
    content = (
      <Card className="overflow-hidden">
        <ul className="divide-y divide-border">
          {years.map((y) => (
            <li key={y.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-[13px]">
              <div className="flex-1"><div className="font-medium">{y.label}</div><div className="text-xs text-muted">Du {fmtDate(y.start_date)} au {fmtDate(y.end_date)}{y.closed_at ? ` · clôturé le ${fmtDate(y.closed_at)}` : ""}</div></div>
              <Badge tone={y.status === "open" ? "positive" : "neutral"} dot>{y.status === "open" ? "Ouvert" : "Clôturé"}</Badge>
              {canWrite && y.status === "open" && <FiscalYearActions orgId={org.id} fyId={y.id} label={y.label} drafts={y.id === fy.id ? drafts ?? 0 : 0} pending={y.id === fy.id ? pending ?? 0 : 0} />}
            </li>
          ))}
        </ul>
        {canWrite && <div className="border-t border-border px-5 py-3"><FiscalYearActions orgId={org.id} openNext /></div>}
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title="Comptabilité"
        description="Le moteur comptable en partie double, conforme au plan comptable associatif (règlement ANC 2018-06)."
        actions={
          <>
            <FiscalYearPicker years={years} current={fy.id} />
            {(tab === "balance" || tab === "grand-livre" || tab === "journaux") && (
              <>
                <a href={exportLink(tab === "balance" ? "balance" : tab === "journaux" ? "journal" : "grand-livre", "xlsx")} className="inline-flex h-8 items-center rounded-md border border-border bg-surface px-3 text-sm font-medium shadow-xs hover:bg-surface-2">Excel</a>
                <a href={exportLink(tab === "balance" ? "balance" : tab === "journaux" ? "journal" : "grand-livre", "csv")} className="inline-flex h-8 items-center rounded-md border border-border bg-surface px-3 text-sm font-medium shadow-xs hover:bg-surface-2">CSV</a>
                <a href={exportLink("fec", "txt")} className="inline-flex h-8 items-center rounded-md border border-border bg-surface px-3 text-sm font-medium shadow-xs hover:bg-surface-2" title="Fichier des écritures comptables (format administration fiscale)">FEC</a>
              </>
            )}
          </>
        }
      >
        <div className="flex flex-wrap gap-1 border-b border-border">
          {TABS.map((t) => (
            <Link key={t.k} href={link({ onglet: t.k, compte: undefined })} className={cn("-mb-px border-b-2 px-3 py-2 text-[13px] font-medium", tab === t.k ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground")}>{t.l}</Link>
          ))}
        </div>
      </PageHeader>
      {content}
    </>
  );
}
