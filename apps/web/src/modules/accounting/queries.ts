import "server-only";
import { cache } from "react";
import { buildBalanceSheet, buildIncomeStatement, type TrialRow } from "@associa/accounting";
import { createClient } from "@/lib/supabase/server";
import type { Account, BankAccount, FiscalYear, Journal, TrialBalanceRow } from "@/lib/types";
import { addDaysISO, todayISO } from "@/lib/utils";

export const getFiscalYears = cache(async (orgId: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("fiscal_years").select("*").eq("organization_id", orgId).order("start_date", { ascending: false });
  return (data ?? []) as FiscalYear[];
});

/** Exercice sélectionné (?exercice=id), sinon celui qui contient aujourd'hui, sinon le plus récent. */
export async function resolveFiscalYear(orgId: string, requested?: string | null): Promise<FiscalYear> {
  const years = await getFiscalYears(orgId);
  const today = todayISO();
  return (
    years.find((y) => y.id === requested) ??
    years.find((y) => y.start_date <= today && today <= y.end_date) ??
    years[0]!
  );
}

export const getAccounts = cache(async (orgId: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("accounts").select("*").eq("organization_id", orgId).order("number");
  return (data ?? []) as Account[];
});

export const getJournals = cache(async (orgId: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("journals").select("id, code, label, type").eq("organization_id", orgId).order("code");
  return (data ?? []) as Journal[];
});

export const getBankAccounts = cache(async (orgId: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("bank_accounts").select("*").eq("organization_id", orgId).order("created_at");
  return (data ?? []) as BankAccount[];
});

export async function getTrialBalance(orgId: string, from: string, to: string): Promise<TrialBalanceRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("trial_balance", { p_org: orgId, p_from: from, p_to: to });
  if (error) throw error;
  return ((data ?? []) as TrialBalanceRow[]).map((r) => ({ ...r, debit: Number(r.debit), credit: Number(r.credit) }));
}

const ORIGIN = "1900-01-01";

/** Compte de résultat + bilan d'un exercice (au plus tard à `at`). */
export async function getStatements(orgId: string, fy: FiscalYear, at?: string) {
  const to = at && at < fy.end_date ? at : fy.end_date;
  const [period, cumulative, prior] = await Promise.all([
    getTrialBalance(orgId, fy.start_date, to),
    getTrialBalance(orgId, ORIGIN, to),
    getTrialBalance(orgId, ORIGIN, addDaysISO(fy.start_date, -1)),
  ]);
  const priorResult = prior.filter((r) => /^[67]/.test(r.number)).reduce((t, r) => t + r.credit - r.debit, 0);
  const asRows = (rows: TrialBalanceRow[]): TrialRow[] => rows.map(({ number, label, debit, credit }) => ({ number, label, debit, credit }));
  return {
    period: asRows(period),
    income: buildIncomeStatement(asRows(period)),
    balance: buildBalanceSheet({ cumulative: asRows(cumulative), currentRows: asRows(period), priorResult }),
    to,
  };
}

/** Trésorerie disponible : soldes des comptes 51x (banques) et 53 (caisse) à date. */
export async function getTreasury(orgId: string, at = todayISO()) {
  const rows = await getTrialBalance(orgId, ORIGIN, at);
  const cash = rows.filter((r) => /^5[13]/.test(r.number));
  return {
    total: cash.reduce((t, r) => t + r.debit - r.credit, 0),
    accounts: cash.map((r) => ({ number: r.number, label: r.label, balance: r.debit - r.credit })),
  };
}
