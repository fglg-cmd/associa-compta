"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isValidAccountNumber, accountKindFromNumber, parseAmount, validateEntry } from "@associa/accounting";
import { requireOrgWriter } from "@/lib/auth";
import { run, unwrap } from "@/lib/action";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");

const simpleSchema = z.object({
  direction: z.enum(["in", "out"]),
  date: isoDate,
  label: z.string().trim().min(1, "Indiquez un libellé.").max(250),
  amount: z.string().transform((s, ctx) => {
    const v = parseAmount(s);
    if (!v || v <= 0) {
      ctx.addIssue({ code: "custom", message: "Montant invalide." });
      return z.NEVER;
    }
    return v;
  }),
  categoryAccountId: z.uuid("Choisissez une catégorie."),
  paymentAccountId: z.uuid("Choisissez le moyen de paiement."),
  projectId: z.union([z.literal(""), z.uuid()]).optional(),
  reference: z.string().trim().max(80).optional(),
  documentId: z.union([z.literal(""), z.uuid()]).optional(),
});

/**
 * Saisie « langage humain » : recette ou dépense payée en banque ou en caisse.
 * Le journal est déduit du compte de trésorerie.
 */
export async function createSimpleEntry(orgId: string, form: FormData) {
  return run(async () => {
    const { supabase, org } = await requireOrgWriter(orgId);
    const v = simpleSchema.parse(Object.fromEntries(form));
    const { data: bank } = await supabase.from("bank_accounts").select("journal_id").eq("organization_id", orgId).eq("account_id", v.paymentAccountId).maybeSingle<{ journal_id: string }>();
    let journalId = bank?.journal_id;
    if (!journalId) {
      const { data: j } = await supabase.from("journals").select("id").eq("organization_id", orgId).eq("code", "CA").single<{ id: string }>();
      journalId = j!.id;
    }
    const project = v.projectId || null;
    const lines =
      v.direction === "in"
        ? [
            { account_id: v.paymentAccountId, debit: v.amount, credit: 0 },
            { account_id: v.categoryAccountId, debit: 0, credit: v.amount, project_id: project },
          ]
        : [
            { account_id: v.categoryAccountId, debit: v.amount, credit: 0, project_id: project },
            { account_id: v.paymentAccountId, debit: 0, credit: v.amount },
          ];
    const id = unwrap(
      await supabase.rpc("create_journal_entry", {
        p_org: orgId,
        p_journal: journalId,
        p_date: v.date,
        p_label: v.label,
        p_lines: lines,
        p_reference: v.reference || null,
        p_post: true,
        p_source: "manual",
        p_project: project,
      }),
    ) as string;
    // Saisie depuis un justificatif : on le rattache à l'écriture créée.
    if (v.documentId) {
      unwrap(await supabase.from("documents").update({ entry_id: id }).eq("id", v.documentId).eq("organization_id", orgId).is("entry_id", null));
    }
    revalidatePath(`/app/${org.slug}`, "layout");
    return id;
  });
}

const expertSchema = z.object({
  journalId: z.uuid(),
  date: isoDate,
  label: z.string().trim().min(1).max(250),
  reference: z.string().trim().max(80).optional(),
  post: z.boolean(),
  lines: z
    .array(z.object({ accountId: z.uuid(), label: z.string().max(250).optional(), debit: z.number().int().min(0), credit: z.number().int().min(0), projectId: z.uuid().nullable().optional() }))
    .min(2)
    .max(200),
});

/** Saisie experte multi-lignes (OD, à-nouveaux, ventilations). */
export async function createExpertEntry(orgId: string, input: z.input<typeof expertSchema>) {
  return run(async () => {
    const { supabase, org } = await requireOrgWriter(orgId);
    const v = expertSchema.parse(input);
    const check = validateEntry(v.lines);
    if (!check.ok) throw new Error(check.error);
    const id = unwrap(
      await supabase.rpc("create_journal_entry", {
        p_org: orgId,
        p_journal: v.journalId,
        p_date: v.date,
        p_label: v.label,
        p_lines: v.lines
          .filter((l) => l.debit > 0 || l.credit > 0)
          .map((l) => ({ account_id: l.accountId, label: l.label || null, debit: l.debit, credit: l.credit, project_id: l.projectId ?? null })),
        p_reference: v.reference || null,
        p_post: v.post,
        p_source: "manual",
        p_project: null,
      }),
    ) as string;
    revalidatePath(`/app/${org.slug}`, "layout");
    return id;
  });
}

export async function postEntry(orgId: string, entryId: string) {
  return run(async () => {
    const { supabase, org } = await requireOrgWriter(orgId);
    unwrap(await supabase.rpc("post_journal_entry", { p_entry: entryId }));
    revalidatePath(`/app/${org.slug}`, "layout");
  });
}

export async function deleteDraftEntry(orgId: string, entryId: string) {
  return run(async () => {
    const { supabase, org } = await requireOrgWriter(orgId);
    unwrap(await supabase.rpc("delete_draft_entry", { p_entry: entryId }));
    revalidatePath(`/app/${org.slug}`, "layout");
  });
}

export async function reverseEntry(orgId: string, entryId: string, date?: string) {
  return run(async () => {
    const { supabase, org } = await requireOrgWriter(orgId);
    // Une écriture issue d'un mouvement bancaire s'annule depuis la banque
    const { data: tx } = await supabase.from("bank_transactions").select("id").eq("entry_id", entryId).maybeSingle<{ id: string }>();
    if (tx) {
      unwrap(await supabase.rpc("unbook_bank_transaction", { p_tx: tx.id }));
    } else {
      unwrap(await supabase.rpc("reverse_journal_entry", { p_entry: entryId, p_date: date ?? null }));
    }
    revalidatePath(`/app/${org.slug}`, "layout");
  });
}

export async function createAccount(orgId: string, form: FormData) {
  return run(async () => {
    const { supabase, org } = await requireOrgWriter(orgId);
    const v = z
      .object({
        number: z.string().trim().refine(isValidAccountNumber, "Numéro de compte invalide (2 à 10 chiffres, classe 1 à 8)."),
        label: z.string().trim().min(2).max(120),
      })
      .parse(Object.fromEntries(form));
    unwrap(await supabase.from("accounts").insert({ organization_id: orgId, number: v.number, label: v.label, kind: accountKindFromNumber(v.number) }));
    revalidatePath(`/app/${org.slug}/comptabilite`);
  });
}

export async function toggleAccount(orgId: string, accountId: string, active: boolean) {
  return run(async () => {
    const { supabase, org } = await requireOrgWriter(orgId);
    unwrap(await supabase.from("accounts").update({ is_active: active }).eq("id", accountId).eq("organization_id", orgId));
    revalidatePath(`/app/${org.slug}/comptabilite`);
  });
}

export async function closeFiscalYear(orgId: string, fyId: string) {
  return run(async () => {
    const { supabase, org } = await requireOrgWriter(orgId);
    unwrap(await supabase.rpc("close_fiscal_year", { p_fy: fyId }));
    revalidatePath(`/app/${org.slug}`, "layout");
  });
}

export async function openNextFiscalYear(orgId: string) {
  return run(async () => {
    const { supabase, org } = await requireOrgWriter(orgId);
    unwrap(await supabase.rpc("open_next_fiscal_year", { p_org: orgId }));
    revalidatePath(`/app/${org.slug}`, "layout");
  });
}
