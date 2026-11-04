import Link from "next/link";
import { Landmark, Settings2 } from "lucide-react";
import { getOrgContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAccounts, getBankAccounts } from "@/modules/accounting/queries";
import { PageHeader, EmptyState, Amount } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { BankTransaction, Project } from "@/lib/types";
import { cn, todayISO } from "@/lib/utils";
import { ImportDialog } from "./import-dialog";
import { NewBankAccountDialog } from "./new-account-dialog";
import { TransactionsTable } from "./transactions-table";

export const metadata = { title: "Banque" };

const PAGE = 100;
const TABS = [
  { key: "pending", label: "À traiter" },
  { key: "done", label: "Comptabilisés" },
  { key: "ignored", label: "Ignorés" },
  { key: "all", label: "Tous" },
] as const;

export default async function BankPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ compte?: string; vue?: string; q?: string; page?: string; action?: string }>;
}) {
  const { org: slug } = await params;
  const sp = await searchParams;
  const { org, canWrite } = await getOrgContext(slug);
  const supabase = await createClient();
  const [bankAccounts, accounts, { data: projects }] = await Promise.all([
    getBankAccounts(org.id),
    getAccounts(org.id),
    supabase.from("projects").select("id, name").eq("organization_id", org.id).neq("status", "closed").order("name"),
  ]);
  const active = bankAccounts.filter((b) => !b.is_archived);
  const base = `/app/${slug}/banque`;

  if (!active.length) {
    return (
      <>
        <PageHeader title="Banque" />
        <Card>
          <EmptyState icon={Landmark} title="Aucun compte bancaire" description="Ajoutez le compte bancaire de l'association pour importer vos relevés." action={canWrite && <NewBankAccountDialog orgId={org.id} />} />
        </Card>
      </>
    );
  }

  const selected = active.find((b) => b.id === sp.compte) ?? null;
  const view = (TABS.find((t) => t.key === sp.vue)?.key ?? "pending") as (typeof TABS)[number]["key"];
  const page = Math.max(1, Number(sp.page) || 1);

  let query = supabase.from("bank_transactions").select("*", { count: "exact" }).eq("organization_id", org.id);
  if (selected) query = query.eq("bank_account_id", selected.id);
  if (view === "pending") query = query.eq("status", "pending");
  if (view === "done") query = query.in("status", ["booked", "matched"]);
  if (view === "ignored") query = query.eq("status", "ignored");
  if (sp.q) query = query.ilike("label", `%${sp.q.replace(/[%_]/g, "")}%`);
  const { data: txs, count } = await query.order("date", { ascending: view === "pending" }).order("created_at").range((page - 1) * PAGE, page * PAGE - 1);

  // Comptes de contrepartie et justificatifs pour les mouvements comptabilisés
  const entryIds = (txs ?? []).map((t) => t.entry_id).filter(Boolean) as string[];
  const txIds = (txs ?? []).map((t) => t.id as string);
  const [{ data: lines }, { data: docs }] = await Promise.all([
    entryIds.length
      ? supabase.from("entry_lines").select("entry_id, account_id").in("entry_id", entryIds)
      : Promise.resolve({ data: [] as { entry_id: string; account_id: string }[] }),
    txIds.length || entryIds.length
      ? supabase.from("documents").select("id, bank_transaction_id, entry_id").eq("organization_id", org.id).or([txIds.length ? `bank_transaction_id.in.(${txIds.join(",")})` : "", entryIds.length ? `entry_id.in.(${entryIds.join(",")})` : ""].filter(Boolean).join(","))
      : Promise.resolve({ data: [] as { id: string; bank_transaction_id: string | null; entry_id: string | null }[] }),
  ]);
  const bankAccountIds = new Set(bankAccounts.map((b) => b.account_id));
  const counterpart = new Map<string, string>();
  for (const l of (lines ?? []) as { entry_id: string; account_id: string }[]) if (!bankAccountIds.has(l.account_id)) counterpart.set(l.entry_id, l.account_id);
  const withDoc = new Set<string>();
  for (const d of (docs ?? []) as { bank_transaction_id: string | null; entry_id: string | null }[]) {
    if (d.bank_transaction_id) withDoc.add(d.bank_transaction_id);
    if (d.entry_id) for (const t of txs ?? []) if (t.entry_id === d.entry_id) withDoc.add(t.id as string);
  }

  const recon = await Promise.all(
    (selected ? [selected] : active).map(async (b) => {
      const { data } = await supabase.rpc("bank_reconciliation", { p_bank_account: b.id, p_at: todayISO() });
      const r = (data as Record<string, number>[])[0]!;
      return {
        account: b,
        statement: Number(r.statement_balance),
        ledger: Number(r.ledger_balance),
        pendingCount: Number(r.pending_count),
        pendingAmount: Number(r.pending_amount),
        unmatchedCount: Number(r.unmatched_ledger_count),
        unmatchedAmount: Number(r.unmatched_ledger_amount),
      };
    }),
  );

  const href = (p: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    const merged = { compte: selected?.id, vue: view, q: sp.q, ...p };
    for (const [k, v] of Object.entries(merged)) if (v) u.set(k, v);
    return `${base}?${u}`;
  };

  return (
    <>
      <PageHeader
        title="Banque"
        description="Importez vos relevés, validez les catégories proposées : la comptabilité se fait toute seule."
        actions={
          <>
            <Button asChild variant="ghost"><Link href={`${base}/regles`}><Settings2 /> Règles</Link></Button>
            {canWrite && <NewBankAccountDialog orgId={org.id} variant="secondary" />}
            {canWrite && <ImportDialog orgId={org.id} bankAccounts={active.map((b) => ({ id: b.id, name: b.name }))} defaultAccountId={selected?.id} defaultOpen={sp.action === "importer"} />}
          </>
        }
      />

      <div className="mb-5 flex flex-wrap gap-1.5">
        <Link href={href({ compte: undefined, page: undefined })} className={cn("rounded-full border px-3 py-1 text-[13px]", !selected ? "border-foreground bg-foreground text-background" : "border-border text-muted hover:text-foreground")}>Tous les comptes</Link>
        {active.map((b) => (
          <Link key={b.id} href={href({ compte: b.id, page: undefined })} className={cn("rounded-full border px-3 py-1 text-[13px]", selected?.id === b.id ? "border-foreground bg-foreground text-background" : "border-border text-muted hover:text-foreground")}>
            {b.name}{b.iban_last4 ? ` ··${b.iban_last4}` : ""}
          </Link>
        ))}
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {recon.map((r) => {
          const gap = r.statement - r.ledger - (r.pendingAmount - r.unmatchedAmount);
          return (
            <Card key={r.account.id} className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium">{r.account.name}</span>
                {r.pendingCount === 0 && r.unmatchedCount === 0 && gap === 0 ? (
                  <span className="text-xs text-positive">Rapproché</span>
                ) : (
                  <span className="text-xs text-warning">{r.pendingCount + r.unmatchedCount} élément(s) à rapprocher</span>
                )}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-[13px]">
                <dt className="text-muted">Solde relevé</dt><dd className="text-right font-semibold"><Amount cents={r.statement} /></dd>
                <dt className="text-muted">Solde comptable</dt><dd className="text-right"><Amount cents={r.ledger} /></dd>
                {r.pendingCount > 0 && (<><dt className="text-muted">Mouvements à traiter</dt><dd className="text-right"><Amount cents={r.pendingAmount} signed /></dd></>)}
                {r.unmatchedCount > 0 && (<><dt className="text-muted">Écritures non pointées</dt><dd className="text-right"><Amount cents={r.unmatchedAmount} signed /></dd></>)}
                {gap !== 0 && (<><dt className="text-negative">Écart inexpliqué</dt><dd className="text-right text-negative"><Amount cents={gap} signed /></dd></>)}
              </dl>
            </Card>
          );
        })}
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5">
          {TABS.map((t) => (
            <Link key={t.key} href={href({ vue: t.key, page: undefined })} className={cn("rounded-md px-2.5 py-1 text-[13px] font-medium", view === t.key ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground")}>
              {t.label}
            </Link>
          ))}
        </div>
        <form className="flex gap-2" action={base}>
          {selected && <input type="hidden" name="compte" value={selected.id} />}
          <input type="hidden" name="vue" value={view} />
          <input name="q" defaultValue={sp.q} placeholder="Rechercher un libellé…" className="h-8 w-56 rounded-md border border-border bg-surface px-2.5 text-sm shadow-xs focus:border-accent focus:outline-none" />
        </form>
      </div>

      <TransactionsTable
        orgId={org.id}
        canWrite={canWrite}
        view={view}
        transactions={((txs ?? []) as BankTransaction[]).map((t) => ({
          ...t,
          counterpartAccountId: t.entry_id ? counterpart.get(t.entry_id) ?? null : null,
          hasDocument: withDoc.has(t.id),
          bankName: bankAccounts.find((b) => b.id === t.bank_account_id)?.name ?? "",
        }))}
        accounts={accounts.map((a) => ({ id: a.id, number: a.number, label: a.label, is_active: a.is_active }))}
        excludeAccountIds={[...bankAccountIds]}
        projects={(projects ?? []) as Pick<Project, "id" | "name">[]}
        showBankName={!selected && active.length > 1}
        slug={slug}
      />

      {(count ?? 0) > PAGE && (
        <div className="mt-4 flex items-center justify-between text-[13px] text-muted">
          <span>{count} mouvements · page {page} / {Math.ceil((count ?? 0) / PAGE)}</span>
          <div className="flex gap-2">
            {page > 1 && <Button asChild size="sm"><Link href={href({ page: String(page - 1) })}>Précédent</Link></Button>}
            {page * PAGE < (count ?? 0) && <Button asChild size="sm"><Link href={href({ page: String(page + 1) })}>Suivant</Link></Button>}
          </div>
        </div>
      )}
    </>
  );
}
