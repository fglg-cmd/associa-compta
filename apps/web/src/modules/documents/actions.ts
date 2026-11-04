"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrgMember, requireOrgWriter } from "@/lib/auth";
import { run, unwrap } from "@/lib/action";
import { planOf } from "@/lib/plans";
import { addDaysISO } from "@/lib/utils";
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
