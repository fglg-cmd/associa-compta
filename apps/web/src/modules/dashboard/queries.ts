import "server-only";
import { detectAnomalies, forecastTreasury, type MonthlyFlow, type TxForAnalysis } from "@associa/accounting";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/fetch-all";
import type { FiscalYear } from "@/lib/types";
import { addDaysISO, todayISO } from "@/lib/utils";
import { getBankAccounts, getStatements, getTreasury } from "../accounting/queries";

function monthStart(iso: string, delta = 0) {
  const [y, m] = iso.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 10);
}

export async function getDashboard(orgId: string, fy: FiscalYear) {
  const supabase = await createClient();
  const today = todayISO();
  const from12 = monthStart(today, -11);

  // Toutes les lectures partent en même temps : un seul aller-retour vers la base.
  const [treasury, statements, flowsRes, bankAccounts, txRes, docsRes, feesRes, projectsRes, recentRes, counts, txEntries, recon] = await Promise.all([
    getTreasury(orgId),
    getStatements(orgId, fy, today),
    supabase.rpc("monthly_flows", { p_org: orgId, p_from: from12, p_to: today }),
    getBankAccounts(orgId),
    fetchAll((a, b) => supabase.from("bank_transactions").select("id, date, label, amount, status").eq("organization_id", orgId).gte("date", addDaysISO(today, -365)).order("date", { ascending: false }).order("id").range(a, b), 20_000).then((data) => ({ data })),
    fetchAll((a, b) => supabase.from("documents").select("bank_transaction_id, entry_id").eq("organization_id", orgId).order("id").range(a, b), 50_000).then((data) => ({ data })),
    fetchAll((a, b) => supabase.from("member_fees").select("id, label, amount_due, amount_paid, due_date, status, members(first_name, last_name)").eq("organization_id", orgId).in("status", ["due", "partial"]).order("due_date").order("id").range(a, b), 50_000).then((data) => ({ data })),
    supabase.from("projects").select("id, name, kind, start_date, end_date, status").eq("organization_id", orgId).neq("status", "closed"),
    supabase.from("journal_entries").select("id, date, label, source, entry_lines(debit, credit, accounts(number))").eq("organization_id", orgId).eq("status", "posted").order("date", { ascending: false }).order("created_at", { ascending: false }).limit(8),
    Promise.all([
      supabase.from("members").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("bank_imports").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("memberships").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("documents").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    ]),
    fetchAll((a, b) => supabase.from("bank_transactions").select("id, entry_id").eq("organization_id", orgId).not("entry_id", "is", null).order("id").range(a, b), 50_000),
    // Écart de rapprochement cumulé sur les comptes bancaires
    getBankAccounts(orgId).then((accounts) =>
      Promise.all(
        accounts.filter((b) => !b.is_archived).map(async (b) => {
          const { data } = await supabase.rpc("bank_reconciliation", { p_bank_account: b.id, p_at: today });
          const r = (data as { statement_balance: number; ledger_balance: number; pending_amount: number; unmatched_ledger_amount: number }[] | null)?.[0];
          // Écart inexpliqué = (relevé − compta) − (en attente − non rapprochés)
          return r ? Number(r.statement_balance) - Number(r.ledger_balance) - (Number(r.pending_amount) - Number(r.unmatched_ledger_amount)) : 0;
        }),
      ),
    ),
  ]);

  const flows: MonthlyFlow[] = ((flowsRes.data ?? []) as { month: string; income: number; expense: number }[]).map((f) => ({
    month: f.month,
    income: Number(f.income),
    expense: Number(f.expense),
  }));

  // Justificatifs : un mouvement est justifié si un document y est lié (directement ou via son écriture)
  const docTx = new Set<string>();
  const docEntries = new Set<string>();
  for (const d of (docsRes.data ?? []) as { bank_transaction_id: string | null; entry_id: string | null }[]) {
    if (d.bank_transaction_id) docTx.add(d.bank_transaction_id);
    if (d.entry_id) docEntries.add(d.entry_id);
  }
  const txs = (txRes.data ?? []) as { id: string; date: string; label: string; amount: number; status: TxForAnalysis["status"] }[];
  const entryByTx = new Map(((txEntries ?? []) as { id: string; entry_id: string }[]).map((t) => [t.id, t.entry_id]));


  const anomalies = detectAnomalies(
    txs.map((t) => ({
      ...t,
      amount: Number(t.amount),
      hasDocument: docTx.has(t.id) || docEntries.has(entryByTx.get(t.id) ?? ""),
    })),
    { today, currentBalance: treasury.total, reconciliationGap: recon.reduce((a, b) => a + b, 0) },
  );

  const fees = (feesRes.data ?? []) as unknown as {
    id: string; label: string; amount_due: number; amount_paid: number; due_date: string; status: string;
    members: { first_name: string; last_name: string } | null;
  }[];

  const forecast = forecastTreasury({
    currentBalance: treasury.total,
    history: flows.slice(0, -1).filter((f) => f.month >= monthStart(today, -6)),
    scheduled: fees.map((f) => ({ date: f.due_date < today ? monthStart(today, 1) : f.due_date, amount: f.amount_due - f.amount_paid, label: f.label })),
    fromMonth: monthStart(today, 1),
    months: 6,
  });

  // Échéancier : uniquement des dates issues des données réelles
  type CalItem = { date: string; title: string; kind: "fee" | "fiscal" | "event" | "project" };
  const calendar: CalItem[] = [];
  const horizon = addDaysISO(today, 120);
  const feeGroups = new Map<string, { count: number; amount: number }>();
  for (const f of fees) {
    if (f.due_date < today || f.due_date > horizon) continue;
    const g = feeGroups.get(f.due_date) ?? { count: 0, amount: 0 };
    g.count++;
    g.amount += f.amount_due - f.amount_paid;
    feeGroups.set(f.due_date, g);
  }
  for (const [date, g] of feeGroups) calendar.push({ date, title: `${g.count} cotisation(s) à échéance`, kind: "fee" });
  if (fy.end_date >= today && fy.end_date <= horizon) calendar.push({ date: fy.end_date, title: `Clôture de l'${fy.label.toLowerCase()}`, kind: "fiscal" });
  for (const p of (projectsRes.data ?? []) as { name: string; kind: string; start_date: string | null; end_date: string | null }[]) {
    if (p.start_date && p.start_date >= today && p.start_date <= horizon) calendar.push({ date: p.start_date, title: p.name, kind: p.kind === "event" ? "event" : "project" });
    else if (p.end_date && p.end_date >= today && p.end_date <= horizon) calendar.push({ date: p.end_date, title: `Fin : ${p.name}`, kind: "project" });
  }
  calendar.sort((a, b) => a.date.localeCompare(b.date));

  const recent = ((recentRes.data ?? []) as unknown as {
    id: string; date: string; label: string; source: string;
    entry_lines: { debit: number; credit: number; accounts: { number: string } }[];
  }[]).map((e) => {
    const cash = e.entry_lines.filter((l) => /^5[13]/.test(l.accounts.number)).reduce((t, l) => t + Number(l.debit) - Number(l.credit), 0);
    const pl = e.entry_lines.filter((l) => /^[67]/.test(l.accounts.number)).reduce((t, l) => t + Number(l.credit) - Number(l.debit), 0);
    return { id: e.id, date: e.date, label: e.label, amount: cash !== 0 ? cash : pl };
  });

  const [members, imports, seats, documents] = counts.map((c) => c.count ?? 0) as [number, number, number, number];
  const pendingTx = txs.filter((t) => t.status === "pending").length;
  const unpaidTotal = fees.reduce((t, f) => t + f.amount_due - f.amount_paid, 0);

  return {
    treasury,
    income: statements.income.totalIncome,
    expense: statements.income.totalExpenses,
    result: statements.income.netResult,
    flows,
    forecast,
    anomalies,
    calendar: calendar.slice(0, 8),
    recent,
    pendingTx,
    unpaidFees: { count: fees.length, total: unpaidTotal },
    checklist: { hasImport: imports > 0, hasMembers: members > 0, hasTeam: seats > 1, hasDocuments: documents > 0, bankAccounts: bankAccounts.length },
  };
}
