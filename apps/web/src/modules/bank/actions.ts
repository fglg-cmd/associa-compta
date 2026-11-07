"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseAmount } from "@associa/accounting";
import {
  BankImportError,
  analyzeCsv,
  categorize,
  decodeBankFile,
  detectFormat,
  fingerprintTransactions,
  parseBankFile,
  suggestRulePattern,
  type CsvMapping,
  type Rule,
} from "@associa/bank-import";
import { requireOrgWriter } from "@/lib/auth";
import { run, unwrap } from "@/lib/action";
import { planOf } from "@/lib/plans";
import type { Account, CategorizationRule } from "@/lib/types";
import { track } from "@/lib/analytics";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function createBankAccount(orgId: string, form: FormData) {
  return run(async () => {
    const { supabase, org } = await requireOrgWriter(orgId);
    const v = z
      .object({
        name: z.string().trim().min(2, "Nom trop court.").max(80),
        bankName: z.string().trim().max(80).optional(),
        ibanLast4: z.string().trim().toUpperCase().regex(/^([0-9A-Z]{4})?$/, "4 derniers caractères de l'IBAN.").optional(),
        openingBalance: z.string().optional(),
        openingDate: isoDate,
      })
      .parse(Object.fromEntries(form));
    const { count } = await supabase.from("bank_accounts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("is_archived", false);
    const limit = planOf(org.plan).limits.bankAccounts;
    if ((count ?? 0) >= limit) throw new Error(`Votre offre est limitée à ${limit} compte(s) bancaire(s). Passez à l'offre supérieure.`);
    unwrap(
      await supabase.rpc("create_bank_account", {
        p_org: orgId,
        p_name: v.name,
        p_bank_name: v.bankName ?? "",
        p_iban_last4: v.ibanLast4 ?? "",
        p_opening_balance: parseAmount(v.openingBalance ?? "") ?? 0,
        p_opening_date: v.openingDate,
      }),
    );
    revalidatePath(`/app/${org.slug}`, "layout");
  });
}

export async function archiveBankAccount(orgId: string, id: string, archived: boolean) {
  return run(async () => {
    const { supabase, org } = await requireOrgWriter(orgId);
    unwrap(await supabase.from("bank_accounts").update({ is_archived: archived }).eq("id", id).eq("organization_id", orgId));
    revalidatePath(`/app/${org.slug}/banque`);
  });
}

function toRule(r: CategorizationRule): Rule {
  return {
    id: r.id,
    matchType: r.match_type,
    pattern: r.pattern,
    direction: r.direction,
    minAmount: r.min_amount,
    maxAmount: r.max_amount,
    accountId: r.account_id,
    projectId: r.project_id,
    priority: r.priority,
    isActive: r.is_active,
  };
}

async function readUpload(form: FormData) {
  const file = form.get("file");
  if (!(file instanceof File)) throw new BankImportError("Aucun fichier reçu.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const rawMapping = form.get("mapping");
  const mapping = typeof rawMapping === "string" && rawMapping ? (JSON.parse(rawMapping) as CsvMapping) : undefined;
  return { file, bytes, mapping };
}

export interface ImportPreview {
  format: "csv" | "ofx" | "qif";
  total: number;
  duplicates: number;
  skipped: number;
  sample: { date: string; label: string; amount: number; duplicate: boolean }[];
  csv?: { headers: string[]; mapping: CsvMapping | null; rows: string[][] };
  dateRange: [string, string] | null;
}

/** Analyse le fichier sans rien écrire : aperçu, doublons, colonnes CSV. */
export async function previewBankImport(orgId: string, bankAccountId: string, form: FormData) {
  return run(async (): Promise<ImportPreview> => {
    const { supabase } = await requireOrgWriter(orgId);
    const { file, bytes, mapping } = await readUpload(form);
    const text = decodeBankFile(bytes);
    const format = detectFormat(file.name, text);
    const csv = format === "csv" ? analyzeCsv(text) : undefined;
    let parsed;
    try {
      parsed = parseBankFile(file.name, bytes, mapping);
    } catch (e) {
      if (csv && e instanceof BankImportError) {
        return { format, total: 0, duplicates: 0, skipped: 0, sample: [], csv: { headers: csv.headers, mapping: mapping ?? csv.mapping, rows: csv.rows.slice(0, 8) }, dateRange: null };
      }
      throw e;
    }
    const fps = fingerprintTransactions(parsed.transactions);
    const { data: existing } = await supabase.from("bank_transactions").select("fingerprint").eq("bank_account_id", bankAccountId).in("fingerprint", fps);
    const dup = new Set((existing ?? []).map((e) => e.fingerprint as string));
    const dates = parsed.transactions.map((t) => t.date).sort();
    return {
      format,
      total: parsed.transactions.length,
      duplicates: fps.filter((f) => dup.has(f)).length,
      skipped: parsed.skipped.length,
      sample: parsed.transactions.slice(0, 8).map((t, i) => ({ date: t.date, label: t.label, amount: t.amount, duplicate: dup.has(fps[i]!) })),
      csv: csv ? { headers: csv.headers, mapping: mapping ?? csv.mapping, rows: csv.rows.slice(Math.max(0, (mapping ?? csv.mapping)?.headerRow ?? 0), 8) } : undefined,
      dateRange: dates.length ? [dates[0]!, dates[dates.length - 1]!] : null,
    };
  });
}

/** Importe le fichier : insertion idempotente + suggestions de catégorie. */
export async function importBankFile(orgId: string, bankAccountId: string, form: FormData) {
  return run(async () => {
    const { supabase, user, org } = await requireOrgWriter(orgId);
    const { file, bytes, mapping } = await readUpload(form);
    const { data: ba } = await supabase.from("bank_accounts").select("id").eq("id", bankAccountId).eq("organization_id", orgId).maybeSingle();
    if (!ba) throw new Error("Compte bancaire introuvable.");

    const parsed = parseBankFile(file.name, bytes, mapping);
    const fps = fingerprintTransactions(parsed.transactions);

    const [{ data: rules }, { data: accounts }] = await Promise.all([
      supabase.from("categorization_rules").select("*").eq("organization_id", orgId).eq("is_active", true),
      supabase.from("accounts").select("id, number").eq("organization_id", orgId).eq("is_active", true),
    ]);
    const accountByNumber = new Map(((accounts ?? []) as Pick<Account, "id" | "number">[]).map((a) => [a.number, a.id]));
    const ruleList = ((rules ?? []) as CategorizationRule[]).map(toRule);

    const imp = unwrap(
      await supabase
        .from("bank_imports")
        .insert({ organization_id: orgId, bank_account_id: bankAccountId, filename: file.name.slice(0, 200), format: parsed.format, row_count: parsed.transactions.length, created_by: user.id })
        .select("id")
        .single<{ id: string }>(),
    )!;

    const rows = parsed.transactions.map((t, i) => {
      const s = categorize(t, ruleList);
      return {
        organization_id: orgId,
        bank_account_id: bankAccountId,
        import_id: imp.id,
        date: t.date,
        value_date: t.valueDate ?? null,
        label: t.label,
        raw_label: t.rawLabel,
        counterparty: t.counterparty ?? null,
        amount: t.amount,
        fingerprint: fps[i]!,
        suggested_account_id: s?.accountId ?? (s?.accountNumber ? accountByNumber.get(s.accountNumber) ?? null : null),
        suggested_rule_id: s?.ruleId ?? null,
        suggested_project_id: s?.projectId ?? null,
      };
    });

    let inserted = 0;
    const fresh: { id: string; date: string; amount: number }[] = [];
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { data, error } = await supabase
        .from("bank_transactions")
        .upsert(chunk, { onConflict: "bank_account_id,fingerprint", ignoreDuplicates: true })
        .select("id, date, amount");
      if (error) throw error;
      inserted += data?.length ?? 0;
      fresh.push(...((data ?? []) as { id: string; date: string; amount: number }[]));
    }
    const matched = await autoMatchExistingEntries(supabase, orgId, bankAccountId, fresh);
    unwrap(await supabase.from("bank_imports").update({ imported_count: inserted, duplicate_count: rows.length - inserted }).eq("id", imp.id));
    await track("bank_import", orgId, { format: parsed.format, rows: rows.length, inserted });
    revalidatePath(`/app/${org.slug}`, "layout");
    return { inserted, duplicates: rows.length - inserted, skipped: parsed.skipped.length, matched };
  });
}

/**
 * Rapprochement automatique à l'import : un mouvement dont le montant correspond exactement à
 * une opération déjà saisie sur ce compte (par exemple créée depuis une facture), datée de
 * 60 jours avant à 10 jours après, et sans autre candidat, lui est rattaché au lieu de créer
 * une seconde écriture. Évite de compter deux fois la même dépense.
 */
async function autoMatchExistingEntries(
  supabase: Awaited<ReturnType<typeof requireOrgWriter>>["supabase"],
  orgId: string,
  bankAccountId: string,
  txs: { id: string; date: string; amount: number }[],
): Promise<number> {
  if (!txs.length) return 0;
  const { data: ba } = await supabase.from("bank_accounts").select("account_id").eq("id", bankAccountId).single<{ account_id: string }>();
  if (!ba) return 0;
  const dates = txs.map((t) => t.date).sort();
  const from = addDays(dates[0]!, -60);
  const to = addDays(dates[dates.length - 1]!, 10);
  const { data: lines } = await supabase
    .from("v_ledger_lines")
    .select("entry_id, date, debit, credit, source")
    .eq("organization_id", orgId)
    .eq("account_id", ba.account_id)
    .eq("status", "posted")
    .in("source", ["manual", "import"])
    .gte("date", from)
    .lte("date", to)
    .limit(5000);
  if (!lines?.length) return 0;
  const net = new Map<string, { date: string; amount: number }>();
  for (const l of lines as { entry_id: string; date: string; debit: number; credit: number }[]) {
    const cur = net.get(l.entry_id) ?? { date: l.date, amount: 0 };
    cur.amount += l.debit - l.credit;
    net.set(l.entry_id, cur);
  }
  const ids = [...net.keys()];
  const [{ data: used }, { data: reversed }] = await Promise.all([
    supabase.from("bank_transactions").select("entry_id").in("entry_id", ids),
    supabase.from("journal_entries").select("reversal_of").eq("organization_id", orgId).in("reversal_of", ids),
  ]);
  const taken = new Set([...(used ?? []).map((u) => u.entry_id as string), ...(reversed ?? []).map((r) => r.reversal_of as string)]);
  let matched = 0;
  for (const tx of txs) {
    const lo = addDays(tx.date, -60);
    const hi = addDays(tx.date, 10);
    const candidates = ids.filter((id) => !taken.has(id) && net.get(id)!.amount === tx.amount && net.get(id)!.date >= lo && net.get(id)!.date <= hi);
    if (candidates.length !== 1) continue;
    const { error } = await supabase.rpc("match_bank_transaction", { p_tx: tx.id, p_entry: candidates[0]! });
    if (!error) {
      taken.add(candidates[0]!);
      matched++;
      // Le justificatif de l'opération justifie désormais aussi ce mouvement bancaire.
      await supabase.from("documents").update({ bank_transaction_id: tx.id }).eq("organization_id", orgId).eq("entry_id", candidates[0]!).is("bank_transaction_id", null);
    }
  }
  return matched;
}

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 864e5).toISOString().slice(0, 10);
}

const bookSchema = z.object({
  items: z.array(z.object({ txId: z.uuid(), accountId: z.uuid(), projectId: z.uuid().nullable().optional(), label: z.string().max(250).optional() })).min(1).max(500),
  learn: z.boolean().default(false),
});

/** Comptabilise un ou plusieurs mouvements ; apprend une règle si demandé. */
export async function bookTransactions(orgId: string, input: z.input<typeof bookSchema>) {
  return run(async () => {
    const { supabase, org } = await requireOrgWriter(orgId);
    const v = bookSchema.parse(input);
    const n = unwrap(
      await supabase.rpc("book_bank_transactions", {
        p_items: v.items.map((i) => ({ tx_id: i.txId, account_id: i.accountId, project_id: i.projectId ?? "", label: i.label ?? "" })),
      }),
    ) as number;

    let learned = 0;
    if (v.learn) {
      const { data: txs } = await supabase.from("bank_transactions").select("id, label, amount, suggested_rule_id").in("id", v.items.map((i) => i.txId));
      const { data: existing } = await supabase.from("categorization_rules").select("pattern").eq("organization_id", orgId);
      const known = new Set((existing ?? []).map((r) => (r.pattern as string).toLowerCase()));
      for (const t of txs ?? []) {
        const item = v.items.find((i) => i.txId === t.id)!;
        if (t.suggested_rule_id) continue;
        const pattern = suggestRulePattern(t.label as string);
        if (!pattern || known.has(pattern)) continue;
        known.add(pattern);
        await supabase.from("categorization_rules").insert({
          organization_id: orgId,
          name: `« ${pattern} »`,
          match_type: "contains",
          pattern,
          direction: (t.amount as number) > 0 ? "in" : "out",
          account_id: item.accountId,
          project_id: item.projectId ?? null,
        });
        learned++;
      }
    }
    // Les mouvements encore en attente qui correspondent aux nouvelles règles reçoivent la suggestion
    if (learned) await refreshSuggestions(orgId);
    revalidatePath(`/app/${org.slug}`, "layout");
    return { booked: n, learned };
  });
}

async function refreshSuggestions(orgId: string) {
  const { supabase } = await requireOrgWriter(orgId);
  const [{ data: rules }, { data: pending }] = await Promise.all([
    supabase.from("categorization_rules").select("*").eq("organization_id", orgId).eq("is_active", true),
    supabase.from("bank_transactions").select("id, label, raw_label, amount, suggested_account_id").eq("organization_id", orgId).eq("status", "pending").limit(2000),
  ]);
  const list = ((rules ?? []) as CategorizationRule[]).map(toRule);
  for (const t of pending ?? []) {
    const s = categorize({ label: t.label as string, rawLabel: (t.raw_label as string) ?? undefined, amount: t.amount as number }, list);
    if (s?.ruleId && s.accountId !== t.suggested_account_id) {
      await supabase.from("bank_transactions").update({ suggested_account_id: s.accountId, suggested_rule_id: s.ruleId, suggested_project_id: s.projectId ?? null }).eq("id", t.id);
    }
  }
}

export async function setTransactionIgnored(orgId: string, txId: string, ignored: boolean) {
  return run(async () => {
    const { supabase, org } = await requireOrgWriter(orgId);
    unwrap(
      await supabase
        .from("bank_transactions")
        .update({ status: ignored ? "ignored" : "pending" })
        .eq("id", txId)
        .eq("organization_id", orgId)
        .in("status", ignored ? ["pending"] : ["ignored"]),
    );
    revalidatePath(`/app/${org.slug}`, "layout");
  });
}

export async function unbookTransaction(orgId: string, txId: string) {
  return run(async () => {
    const { supabase, org } = await requireOrgWriter(orgId);
    unwrap(await supabase.rpc("unbook_bank_transaction", { p_tx: txId }));
    revalidatePath(`/app/${org.slug}`, "layout");
  });
}

export interface MatchCandidate {
  entryId: string;
  date: string;
  label: string;
  entryNumber: number | null;
}

/** Écritures validées sur le compte bancaire, de même montant, non rapprochées, à ±20 jours. */
export async function findMatchCandidates(orgId: string, txId: string) {
  return run(async (): Promise<MatchCandidate[]> => {
    const { supabase } = await requireOrgWriter(orgId);
    const { data: tx } = await supabase.from("bank_transactions").select("date, amount, bank_account_id, bank_accounts(account_id)").eq("id", txId).eq("organization_id", orgId).single();
    if (!tx) throw new Error("Mouvement introuvable.");
    const accountId = (tx.bank_accounts as unknown as { account_id: string }).account_id;
    const d = new Date(`${tx.date}T00:00:00Z`);
    const from = new Date(d.getTime() - 20 * 864e5).toISOString().slice(0, 10);
    const to = new Date(d.getTime() + 20 * 864e5).toISOString().slice(0, 10);
    const amount = tx.amount as number;
    const { data: lines } = await supabase
      .from("v_ledger_lines")
      .select("entry_id, date, label, entry_number, debit, credit, source")
      .eq("organization_id", orgId)
      .eq("account_id", accountId)
      .eq("status", "posted")
      .neq("source", "opening")
      .gte("date", from)
      .lte("date", to)
      .eq(amount > 0 ? "debit" : "credit", Math.abs(amount));
    const ids = (lines ?? []).map((l) => l.entry_id as string);
    if (!ids.length) return [];
    const { data: used } = await supabase.from("bank_transactions").select("entry_id").in("entry_id", ids);
    const usedSet = new Set((used ?? []).map((u) => u.entry_id as string));
    return (lines ?? [])
      .filter((l) => !usedSet.has(l.entry_id as string))
      .map((l) => ({ entryId: l.entry_id as string, date: l.date as string, label: l.label as string, entryNumber: l.entry_number as number | null }));
  });
}

export async function matchTransaction(orgId: string, txId: string, entryId: string) {
  return run(async () => {
    const { supabase, org } = await requireOrgWriter(orgId);
    unwrap(await supabase.rpc("match_bank_transaction", { p_tx: txId, p_entry: entryId }));
    revalidatePath(`/app/${org.slug}`, "layout");
  });
}

const ruleSchema = z.object({
  name: z.string().trim().min(1).max(120),
  matchType: z.enum(["contains", "starts_with", "equals", "regex"]),
  pattern: z.string().trim().min(1).max(200),
  direction: z.enum(["any", "in", "out"]),
  accountId: z.uuid("Choisissez un compte."),
  projectId: z.union([z.literal(""), z.uuid()]).optional(),
  priority: z.coerce.number().int().min(1).max(1000).default(100),
});

export async function saveRule(orgId: string, ruleId: string | null, form: FormData) {
  return run(async () => {
    const { supabase, org } = await requireOrgWriter(orgId);
    const v = ruleSchema.parse(Object.fromEntries(form));
    if (v.matchType === "regex") {
      try {
        new RegExp(v.pattern);
      } catch {
        throw new Error("Expression régulière invalide.");
      }
    }
    const row = { name: v.name, match_type: v.matchType, pattern: v.pattern, direction: v.direction, account_id: v.accountId, project_id: v.projectId || null, priority: v.priority };
    if (ruleId) unwrap(await supabase.from("categorization_rules").update(row).eq("id", ruleId).eq("organization_id", orgId));
    else unwrap(await supabase.from("categorization_rules").insert({ ...row, organization_id: orgId }));
    await refreshSuggestions(orgId);
    revalidatePath(`/app/${org.slug}/banque`, "layout");
  });
}

export async function deleteRule(orgId: string, ruleId: string) {
  return run(async () => {
    const { supabase, org } = await requireOrgWriter(orgId);
    unwrap(await supabase.from("categorization_rules").delete().eq("id", ruleId).eq("organization_id", orgId));
    revalidatePath(`/app/${org.slug}/banque`, "layout");
  });
}

export async function toggleRule(orgId: string, ruleId: string, active: boolean) {
  return run(async () => {
    const { supabase, org } = await requireOrgWriter(orgId);
    unwrap(await supabase.from("categorization_rules").update({ is_active: active }).eq("id", ruleId).eq("organization_id", orgId));
    revalidatePath(`/app/${org.slug}/banque`, "layout");
  });
}
