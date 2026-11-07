import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatEUR } from "@associa/accounting";
import { runOcr } from "@/lib/ocr";
import { checkTotal } from "@/lib/ocr-extract";
import { autoCreateOperation, autoMatchDocument, type AutoOperation } from "@/modules/documents/actions";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Lance l'OCR d'un document (appelé juste après l'envoi, ou pour relancer). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: doc } = await supabase.from("documents").select("id, organization_id, storage_path, mime_type, entry_id, bank_transaction_id").eq("id", id).maybeSingle();
  if (!doc) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  const { data: canWrite } = await supabase.rpc("can_write_finance", { org: doc.organization_id });
  if (!canWrite) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  await supabase.from("documents").update({ ocr_status: "processing" }).eq("id", id);
  const file = await supabase.storage.from("documents").download(doc.storage_path as string);
  if (file.error || !file.data) {
    await supabase.from("documents").update({ ocr_status: "failed" }).eq("id", id);
    return NextResponse.json({ error: "Fichier introuvable dans le stockage" }, { status: 500 });
  }
  // Le nom de l'association est exclu de la détection du fournisseur (c'est le client de la facture).
  const { data: org } = await supabase.from("organizations").select("name").eq("id", doc.organization_id).maybeSingle<{ name: string }>();
  const result = await runOcr(Buffer.from(await file.data.arrayBuffer()), doc.mime_type as string, { exclude: org?.name ? [org.name] : [] });
  await supabase
    .from("documents")
    .update({
      ocr_status: result.status,
      ocr_text: result.text || null,
      extracted_amount: result.fields.amount,
      extracted_date: result.fields.date,
      extracted_vendor: result.fields.vendor,
    })
    .eq("id", id);
  const orgId = doc.organization_id as string;
  // Justificatif déjà rattaché (envoyé depuis un mouvement bancaire, ou relu) : rien à créer.
  const linked = Boolean(doc.entry_id || doc.bank_transaction_id);
  const matchedTx = result.status === "done" && !linked ? await autoMatchDocument(orgId, id) : null;
  // Pas de mouvement bancaire correspondant : la dépense (ou recette) est créée directement.
  // Lecture fiable seulement : texte natif (PDF, Word…), ou photo lue avec une confiance d'au
  // moins 75 %, et jamais si HT + TVA contredit le total. Une photo floue dont HT + TVA
  // confirment le total reste fiable. Sinon : formulaire pré-rempli, à vérifier.
  const amount = result.fields.amount;
  const check = amount ? checkTotal(result.text, amount) : "unknown";
  const trusted = check === "consistent" || (check === "unknown" && (result.confidence == null || result.confidence >= 75));
  let operation: AutoOperation | null = null;
  if (result.status === "done" && !linked && !matchedTx) {
    operation = trusted || !amount
      ? await autoCreateOperation(orgId, id)
      : { created: false, reason: `Lecture incertaine (${formatEUR(amount)} ?) : vérifiez le montant puis enregistrez.` };
  }
  return NextResponse.json({ status: result.status, engine: result.engine, fields: result.fields, matchedTx, operation, linked, message: result.message });
}
