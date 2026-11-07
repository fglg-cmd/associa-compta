"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrgMember, requireOrgWriter } from "@/lib/auth";
import { run, unwrap } from "@/lib/action";
import { planOf } from "@/lib/plans";
import { addDaysISO, todayISO } from "@/lib/utils";
import { categorize } from "@associa/bank-import";
import { detectDirection, extractReference } from "@/lib/ocr-extract";
import { CATEGORIES } from "@associa/accounting";
import { getAccounts, getBankAccounts, resolveFiscalYear } from "@/modules/accounting/queries";
import type { CategorizationRule } from "@/lib/types";
import { ALLOWED_MIME, MAX_DOCUMENT_BYTES } from "./constants";

const safeName = (n: string) =>
  n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/_+/g, "_").slice(-120) || "document";

/** Valide le fichier et les quotas avant l'envoi direct au stockage. */
export async function prepareUpload(orgId: string, input: { name: string; size: number; mime: string }) {
  return run(async () => {
    const { supabase, org } = await requireOrgWriter(orgId);
    if (!ALLOWED_MIME[input.mime]) throw new Error("Type de fichier non accepté : PDF, image, Word ou Excel uniquement.");
    if (input.size <= 0 || input.size > MAX_DOCUMENT_BYTES) throw new Error("Fichier trop volumineux (25 Mo maximum).");
    const { count } = await supabase.from("documents").select("*", { count: "exact", head: true }).eq("organization_id", orgId);
    const limit = planOf(org.plan).limits.documents;
    if ((count ?? 0) >= limit) throw new Error(`Limite de ${limit} documents atteinte pour votre offre.`);
    const id = crypto.randomUUID();
    return { id, path: `${orgId}/${id}/${safeName(input.name)}` };
  });
}

const registerSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(200),
  path: z.string().min(10).max(400),
  mime: z.string(),
  size: z.number().int().positive().max(MAX_DOCUMENT_BYTES),
  folder: z.string().trim().min(1).max(60).default("Justificatifs"),
  txId: z.uuid().nullable().optional(),
});

export async function registerDocument(orgId: string, input: z.input<typeof registerSchema>) {
  return run(async () => {
    const { supabase, user, org } = await requireOrgWriter(orgId);
    const v = registerSchema.parse(input);
    if (!v.path.startsWith(`${orgId}/${v.id}/`)) throw new Error("Chemin de stockage invalide.");
    if (!ALLOWED_MIME[v.mime]) throw new Error("Type de fichier non accepté.");
    let entryId: string | null = null;
    if (v.txId) {
      const { data } = await supabase.from("bank_transactions").select("entry_id").eq("id", v.txId).eq("organization_id", orgId).maybeSingle<{ entry_id: string | null }>();
      entryId = data?.entry_id ?? null;
    }
    unwrap(
      await supabase.from("documents").insert({
        id: v.id,
        organization_id: orgId,
        name: v.name,
        storage_path: v.path,
        mime_type: v.mime,
        size_bytes: v.size,
        folder: v.folder,
        uploaded_by: user.id,
        bank_transaction_id: v.txId ?? null,
        entry_id: entryId,
      }),
    );
    revalidatePath(`/app/${org.slug}/justificatifs`);
    return v.id;
  });
}

/** Rattache automatiquement le justificatif au mouvement bancaire de même montant (s'il est unique). */
export async function autoMatchDocument(orgId: string, docId: string) {
  const { supabase } = await requireOrgWriter(orgId);
  const { data: doc } = await supabase.from("documents").select("extracted_amount, extracted_date, created_at, bank_transaction_id, entry_id").eq("id", docId).eq("organization_id", orgId).single();
  if (!doc || doc.bank_transaction_id || doc.entry_id || !doc.extracted_amount) return null;
  const ref = (doc.extracted_date as string | null) ?? (doc.created_at as string).slice(0, 10);
  const { data: txs } = await supabase
    .from("bank_transactions")
    .select("id, entry_id")
    .eq("organization_id", orgId)
    .in("amount", [-(doc.extracted_amount as number), doc.extracted_amount as number])
    .gte("date", addDaysISO(ref, -10))
    .lte("date", addDaysISO(ref, 45))
    .neq("status", "ignored");
  if (!txs?.length) return null;
  const { data: used } = await supabase.from("documents").select("bank_transaction_id").in("bank_transaction_id", txs.map((t) => t.id));
  const free = txs.filter((t) => !(used ?? []).some((u) => u.bank_transaction_id === t.id));
  if (free.length !== 1) return null;
  await supabase.from("documents").update({ bank_transaction_id: free[0]!.id, entry_id: free[0]!.entry_id }).eq("id", docId);
  return free[0]!.id as string;
}

export async function updateDocument(orgId: string, docId: string, input: { name?: string; folder?: string; tags?: string[]; txId?: string | null }) {
  return run(async () => {
    const { supabase, org } = await requireOrgWriter(orgId);
    const v = z
      .object({
        name: z.string().trim().min(1).max(200).optional(),
        folder: z.string().trim().min(1).max(60).optional(),
        tags: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
        txId: z.uuid().nullable().optional(),
      })
      .parse(input);
    const patch: Record<string, unknown> = {};
    if (v.name) patch.name = v.name;
    if (v.folder) patch.folder = v.folder;
    if (v.tags) patch.tags = v.tags;
    if (v.txId !== undefined) {
      patch.bank_transaction_id = v.txId;
      patch.entry_id = null;
      if (v.txId) {
        const { data } = await supabase.from("bank_transactions").select("entry_id").eq("id", v.txId).eq("organization_id", orgId).single<{ entry_id: string | null }>();
        patch.entry_id = data?.entry_id ?? null;
      }
    }
    unwrap(await supabase.from("documents").update(patch).eq("id", docId).eq("organization_id", orgId));
    revalidatePath(`/app/${org.slug}/justificatifs`);
  });
}

export async function deleteDocument(orgId: string, docId: string) {
  return run(async () => {
    const { supabase, org } = await requireOrgWriter(orgId);
    const { data: doc } = await supabase.from("documents").select("storage_path").eq("id", docId).eq("organization_id", orgId).single<{ storage_path: string }>();
    if (!doc) throw new Error("Document introuvable.");
    await supabase.storage.from("documents").remove([doc.storage_path]);
    unwrap(await supabase.from("documents").delete().eq("id", docId));
    revalidatePath(`/app/${org.slug}/justificatifs`);
  });
}

export async function getDocumentUrl(orgId: string, docId: string, download = false) {
  return run(async () => {
    const { supabase } = await requireOrgMember(orgId);
    const { data: doc } = await supabase.from("documents").select("storage_path, name").eq("id", docId).eq("organization_id", orgId).single<{ storage_path: string; name: string }>();
    if (!doc) throw new Error("Document introuvable.");
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(doc.storage_path, 600, download ? { download: doc.name } : undefined);
    if (error) throw error;
    return data.signedUrl;
  });
}

export interface OperationDraft {
  direction: "in" | "out";
  label: string;
  amount: number | null;
  date: string;
  dateFromDocument: boolean;
  reference: string;
  categoryAccountId: string;
  categoryGuessed: boolean;
  /** Banque par défaut ; caisse si le ticket indique un paiement en espèces. */
  paymentAccountId: string;
}

export interface OperationFormData {
  draft: OperationDraft;
  accounts: { id: string; number: string; label: string; is_active: boolean }[];
  treasury: { id: string; label: string }[];
  projects: { id: string; name: string }[];
  minDate: string;
  maxDate: string;
}

type Supa = Awaited<ReturnType<typeof requireOrgWriter>>["supabase"];
type DocForDraft = { name: string; extracted_amount: number | null; extracted_date: string | null; extracted_vendor: string | null; ocr_text: string | null; entry_id: string | null; bank_transaction_id: string | null };

/** Lignes de total, TVA, paiement : écartées pour proposer la catégorie (« TOTAL » = station-service). */
const NOT_DETAIL = /\b(sous[\s-]?)?total|montant|t\.?v\.?a\b|\bh\.?t\b|t\.?t\.?c|net [àa] payer|paiement|r[èe]glement|iban|bic|siret|siren|[ée]ch[ée]ance/i;

/**
 * Prépare l'opération correspondant à un justificatif lu : sens (dépense ou recette), montant,
 * date, libellé, référence, catégorie (règles apprises puis mots-clés) et compte de paiement.
 */
async function buildOperation(supabase: Supa, orgId: string, orgName: string, docId: string): Promise<OperationFormData> {
  const { data: doc } = await supabase
    .from("documents")
    .select("name, extracted_amount, extracted_date, extracted_vendor, ocr_text, entry_id, bank_transaction_id")
    .eq("id", docId)
    .eq("organization_id", orgId)
    .maybeSingle<DocForDraft>();
  if (!doc) throw new Error("Document introuvable.");
  if (doc.entry_id || doc.bank_transaction_id) throw new Error("Ce justificatif est déjà rattaché à une opération.");

  const [fy, accounts, banks, { data: projects }, { data: rules }] = await Promise.all([
    resolveFiscalYear(orgId),
    getAccounts(orgId),
    getBankAccounts(orgId),
    supabase.from("projects").select("id, name").eq("organization_id", orgId).neq("status", "closed").order("name"),
    supabase.from("categorization_rules").select("*").eq("organization_id", orgId).eq("is_active", true),
  ]);
  if (!fy || fy.status !== "open") throw new Error("Aucun exercice ouvert : ouvrez l'exercice en cours dans Comptabilité.");

  const text = doc.ocr_text ?? "";
  const direction = detectDirection(text, [orgName]);
  const amount = doc.extracted_amount && doc.extracted_amount > 0 ? doc.extracted_amount : null;
  const detail = text.slice(0, 4000).split(/\r?\n/).filter((l) => !NOT_DETAIL.test(l)).join("\n");
  const ruleList = ((rules ?? []) as CategorizationRule[]).map((r) => ({
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
  }));
  const sign = direction === "in" ? 1 : -1;
  // Les frais bancaires et intérêts n'apparaissent pas sur une facture (« frais de port »…).
  const suggestion = categorize({ label: `${doc.extracted_vendor ?? ""}\n${detail}`, amount: sign * (amount ?? 1) }, ruleList, { excludeCategories: ["bank_fees", "interest"] });
  const active = accounts.filter((a) => a.is_active);
  const byNumber = new Map(active.map((a) => [a.number, a.id]));
  const cls = direction === "in" ? "7" : "6";
  const guessed = suggestion?.accountId ?? (suggestion?.accountNumber ? byNumber.get(suggestion.accountNumber) : undefined);
  const categoryAccountId = guessed && active.some((a) => a.id === guessed && a.number.startsWith(cls)) ? guessed : "";

  const inYear = (d: string | null) => Boolean(d && d >= fy.start_date && d <= fy.end_date);
  const today = todayISO();
  const fallbackDate = today < fy.start_date ? fy.start_date : today > fy.end_date ? fy.end_date : today;
  const vendor = doc.extracted_vendor?.trim();
  const reference = (text ? extractReference(text) : null)?.slice(0, 80) ?? "";
  const baseName = doc.name.replace(/\.[a-z0-9]{2,5}$/i, "");
  const label =
    direction === "out"
      ? vendor ? `Facture ${vendor}` : baseName
      : reference ? `Facture n° ${reference}` : baseName;

  const treasury = [
    ...banks.filter((b) => !b.is_archived).map((b) => ({ id: b.account_id, label: b.name })),
    ...accounts.filter((a) => a.number === "530").map((a) => ({ id: a.id, label: "Caisse (espèces)" })),
  ];
  const cash = /\b(esp[eè]ces|cash|liquide)\b/i.test(text) ? accounts.find((a) => a.number === "530" && a.is_active) : undefined;

  return {
    draft: {
      direction,
      label: label.slice(0, 250),
      amount,
      date: inYear(doc.extracted_date) ? doc.extracted_date! : fallbackDate,
      dateFromDocument: inYear(doc.extracted_date),
      reference,
      categoryAccountId,
      categoryGuessed: Boolean(categoryAccountId),
      paymentAccountId: cash?.id ?? treasury[0]?.id ?? "",
    },
    accounts: accounts.map((a) => ({ id: a.id, number: a.number, label: a.label, is_active: a.is_active })),
    treasury,
    projects: (projects ?? []) as { id: string; name: string }[],
    minDate: fy.start_date,
    maxDate: fy.end_date,
  };
}

/** Formulaire pré-rempli (quand l'opération n'a pas pu être créée automatiquement). */
export async function getOperationDraft(orgId: string, docId: string) {
  return run(async (): Promise<OperationFormData> => {
    const { supabase, org } = await requireOrgWriter(orgId);
    return buildOperation(supabase, orgId, org.name, docId);
  });
}

export type AutoOperation =
  | { created: true; entryId: string; direction: "in" | "out"; amount: number; category: string }
  | { created: false; reason: string };

/**
 * Création automatique de l'opération dès la lecture du justificatif : une facture reçue
 * devient une dépense, une facture émise par l'association une recette. Payée depuis le
 * premier compte bancaire (ou la caisse). Annulable en un clic (contre-passation).
 * Rien n'est créé si le montant n'a pas été lu : le trésorier complète alors le formulaire.
 */
export async function autoCreateOperation(orgId: string, docId: string): Promise<AutoOperation> {
  const { supabase, org } = await requireOrgWriter(orgId);
  let ctx: OperationFormData;
  try {
    ctx = await buildOperation(supabase, orgId, org.name, docId);
  } catch (e) {
    return { created: false, reason: (e as Error).message };
  }
  const { draft } = ctx;
  if (!draft.amount) return { created: false, reason: "Montant non lu : complétez l'opération." };
  // Même facture déjà envoyée (même montant, même date lue, déjà enregistrée) : pas de doublon.
  if (draft.dateFromDocument) {
    const { data: twins } = await supabase
      .from("documents")
      .select("id")
      .eq("organization_id", orgId)
      .eq("extracted_amount", draft.amount)
      .eq("extracted_date", draft.date)
      .neq("id", docId)
      .or("entry_id.not.is.null,bank_transaction_id.not.is.null")
      .limit(1);
    if (twins?.length) return { created: false, reason: "Facture déjà enregistrée (doublon probable) : rien n'a été créé." };
  }
  const payment = ctx.treasury.find((t) => t.id === draft.paymentAccountId) ?? ctx.treasury[0];
  if (!payment) return { created: false, reason: "Aucun compte bancaire ni caisse." };

  const fallback = ctx.accounts.find((a) => a.is_active && a.number === (draft.direction === "in" ? "758" : "658"));
  const categoryId = draft.categoryAccountId || fallback?.id;
  if (!categoryId) return { created: false, reason: "Catégorie introuvable : complétez l'opération." };
  const category = ctx.accounts.find((a) => a.id === categoryId)!;

  const { data: bank } = await supabase.from("bank_accounts").select("journal_id").eq("organization_id", orgId).eq("account_id", payment.id).maybeSingle<{ journal_id: string }>();
  let journalId = bank?.journal_id;
  if (!journalId) {
    const { data: j } = await supabase.from("journals").select("id").eq("organization_id", orgId).eq("code", "CA").maybeSingle<{ id: string }>();
    journalId = j?.id;
  }
  if (!journalId) return { created: false, reason: "Journal introuvable." };

  const lines =
    draft.direction === "in"
      ? [{ account_id: payment.id, debit: draft.amount, credit: 0 }, { account_id: categoryId, debit: 0, credit: draft.amount }]
      : [{ account_id: categoryId, debit: draft.amount, credit: 0 }, { account_id: payment.id, debit: 0, credit: draft.amount }];
  const { data: entryId, error } = await supabase.rpc("create_journal_entry", {
    p_org: orgId,
    p_journal: journalId,
    p_date: draft.date,
    p_label: draft.label,
    p_lines: lines,
    p_reference: draft.reference || null,
    p_post: true,
    p_source: "manual",
    p_project: null,
  });
  if (error || !entryId) return { created: false, reason: error?.message ?? "Création impossible." };
  await supabase.from("documents").update({ entry_id: entryId as string }).eq("id", docId).eq("organization_id", orgId);
  revalidatePath(`/app/${org.slug}`, "layout");
  const catLabel = CATEGORIES.find((c) => c.account === category.number)?.label ?? category.label;
  return { created: true, entryId: entryId as string, direction: draft.direction, amount: draft.amount, category: catLabel };
}

/**
 * Annule l'opération créée depuis un justificatif (contre-passation : la comptabilité garde
 * la trace) et libère le justificatif pour une nouvelle saisie.
 */
export async function undoDocumentOperation(orgId: string, docId: string) {
  return run(async () => {
    const { supabase, org } = await requireOrgWriter(orgId);
    const { data: doc } = await supabase.from("documents").select("entry_id").eq("id", docId).eq("organization_id", orgId).maybeSingle<{ entry_id: string | null }>();
    if (!doc?.entry_id) throw new Error("Aucune opération à annuler.");
    const { data: tx } = await supabase.from("bank_transactions").select("id").eq("entry_id", doc.entry_id).maybeSingle();
    if (tx) throw new Error("Cette opération est rapprochée d'un mouvement bancaire : annulez-la depuis la page Banque.");
    unwrap(await supabase.rpc("reverse_journal_entry", { p_entry: doc.entry_id, p_date: null }));
    unwrap(await supabase.from("documents").update({ entry_id: null }).eq("id", docId).eq("organization_id", orgId));
    revalidatePath(`/app/${org.slug}`, "layout");
  });
}
