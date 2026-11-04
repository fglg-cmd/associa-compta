import Link from "next/link";
import { getOrgContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAccounts, getBankAccounts, getFiscalYears, getJournals, resolveFiscalYear } from "@/modules/accounting/queries";
import { PageHeader } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EntryDialog } from "./entry-dialog";
import { EntriesList, type EntryView } from "./entries-list";
import { FiscalYearPicker } from "@/components/finance/fiscal-year-picker";

export const metadata = { title: "Opérations" };
const PAGE = 50;

export default async function OperationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ exercice?: string; journal?: string; statut?: string; q?: string; page?: string; action?: string; ecriture?: string }>;
}) {
  const { org: slug } = await params;
  const sp = await searchParams;
  const { org, canWrite } = await getOrgContext(slug);
  const supabase = await createClient();
  const [fy, years, journals, accounts, banks, { data: projects }] = await Promise.all([
    resolveFiscalYear(org.id, sp.exercice),
    getFiscalYears(org.id),
    getJournals(org.id),
    getAccounts(org.id),
    getBankAccounts(org.id),
    supabase.from("projects").select("id, name").eq("organization_id", org.id).neq("status", "closed").order("name"),
  ]);
  const page = Math.max(1, Number(sp.page) || 1);

  let q = supabase
    .from("journal_entries")
    .select("id, date, label, reference, status, source, entry_number, journal_id, reversal_of, entry_lines(id, line_no, account_id, label, debit, credit)", { count: "exact" })
    .eq("organization_id", org.id);
  if (sp.ecriture) q = q.eq("id", sp.ecriture);
  else q = q.eq("fiscal_year_id", fy.id);
  if (sp.journal) q = q.eq("journal_id", sp.journal);
  if (sp.statut === "draft" || sp.statut === "posted") q = q.eq("status", sp.statut);
  if (sp.q) q = q.ilike("label", `%${sp.q.replace(/[%_]/g, "")}%`);
  const { data, count } = await q.order("date", { ascending: false }).order("entry_number", { ascending: false, nullsFirst: true }).range((page - 1) * PAGE, page * PAGE - 1);

  const { data: reversed } = await supabase.from("journal_entries").select("reversal_of").eq("organization_id", org.id).not("reversal_of", "is", null);
  const reversedSet = new Set((reversed ?? []).map((r) => r.reversal_of as string));
  const accLabel = Object.fromEntries(accounts.map((a) => [a.id, { number: a.number, label: a.label }]));
  const jrn = Object.fromEntries(journals.map((j) => [j.id, j.code]));

  const entries: EntryView[] = ((data ?? []) as unknown as (EntryView & { journal_id: string; entry_lines: EntryView["lines"] })[]).map((e) => ({
    ...e,
    journal: jrn[e.journal_id] ?? "",
    reversed: reversedSet.has(e.id),
    lines: [...e.entry_lines].sort((a, b) => a.line_no - b.line_no),
  }));

  const base = `/app/${slug}/operations`;
  const href = (p: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ exercice: sp.exercice, journal: sp.journal, statut: sp.statut, q: sp.q, ...p })) if (v) u.set(k, v);
    return `${base}?${u}`;
  };
  const treasury = [
    ...banks.filter((b) => !b.is_archived).map((b) => ({ id: b.account_id, label: b.name })),
    ...accounts.filter((a) => a.number === "530").map((a) => ({ id: a.id, label: "Caisse (espèces)" })),
  ];

  return (
    <>
      <PageHeader
        title="Opérations"
        description="Toutes les écritures comptables, quelle que soit leur origine : banque, cotisations, saisie manuelle."
        actions={
          <>
            <FiscalYearPicker years={years} current={fy.id} />
            {canWrite && fy.status === "open" && (
              <EntryDialog
                orgId={org.id}
                accounts={accounts.map((a) => ({ id: a.id, number: a.number, label: a.label, is_active: a.is_active }))}
                journals={journals.filter((j) => j.type !== "opening" || true)}
                treasury={treasury}
                projects={(projects ?? []) as Pick<Project, "id" | "name">[]}
                defaultOpen={sp.action === "nouvelle"}
                minDate={fy.start_date}
                maxDate={fy.end_date}
              />
            )}
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap rounded-lg border border-border bg-surface-2 p-0.5">
          <Link href={href({ journal: undefined, page: undefined })} className={cn("rounded-md px-2.5 py-1 text-[13px] font-medium", !sp.journal ? "bg-surface shadow-sm" : "text-muted")}>Tous les journaux</Link>
          {journals.map((j) => (
            <Link key={j.id} href={href({ journal: j.id, page: undefined })} className={cn("rounded-md px-2.5 py-1 text-[13px] font-medium", sp.journal === j.id ? "bg-surface shadow-sm" : "text-muted hover:text-foreground")} title={j.label}>{j.code}</Link>
          ))}
        </div>
        <div className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5">
          {[["", "Toutes"], ["posted", "Validées"], ["draft", "Brouillons"]].map(([k, l]) => (
            <Link key={k} href={href({ statut: k || undefined, page: undefined })} className={cn("rounded-md px-2.5 py-1 text-[13px] font-medium", (sp.statut ?? "") === k ? "bg-surface shadow-sm" : "text-muted hover:text-foreground")}>{l}</Link>
          ))}
        </div>
        <form action={base} className="ml-auto">
          {sp.exercice && <input type="hidden" name="exercice" value={sp.exercice} />}
          <input name="q" defaultValue={sp.q} placeholder="Rechercher…" className="h-8 w-52 rounded-md border border-border bg-surface px-2.5 text-sm shadow-xs focus:border-accent focus:outline-none" />
        </form>
      </div>

      <EntriesList orgId={org.id} entries={entries} accounts={accLabel} canWrite={canWrite && fy.status === "open"} highlight={sp.ecriture} />

      {(count ?? 0) > PAGE && (
        <div className="mt-4 flex items-center justify-between text-[13px] text-muted">
          <span>{count} écritures · page {page}</span>
          <div className="flex gap-2">
            {page > 1 && <Button asChild size="sm"><Link href={href({ page: String(page - 1) })}>Précédent</Link></Button>}
            {page * PAGE < (count ?? 0) && <Button asChild size="sm"><Link href={href({ page: String(page + 1) })}>Suivant</Link></Button>}
          </div>
        </div>
      )}
    </>
  );
}
