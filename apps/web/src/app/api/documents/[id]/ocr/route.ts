import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runOcr } from "@/lib/ocr";
import { autoMatchDocument } from "@/modules/documents/actions";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Lance l'OCR d'un document (appelé juste après l'envoi, ou pour relancer). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: doc } = await supabase.from("documents").select("id, organization_id, storage_path, mime_type").eq("id", id).maybeSingle();
  if (!doc) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  const { data: canWrite } = await supabase.rpc("can_write_finance", { org: doc.organization_id });
  if (!canWrite) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  await supabase.from("documents").update({ ocr_status: "processing" }).eq("id", id);
  const file = await supabase.storage.from("documents").download(doc.storage_path as string);
  if (file.error || !file.data) {
    await supabase.from("documents").update({ ocr_status: "failed" }).eq("id", id);
    return NextResponse.json({ error: "Fichier introuvable dans le stockage" }, { status: 500 });
  }
  const result = await runOcr(Buffer.from(await file.data.arrayBuffer()), doc.mime_type as string);
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
  const matchedTx = result.status === "done" ? await autoMatchDocument(doc.organization_id as string, id) : null;
  return NextResponse.json({ status: result.status, engine: result.engine, fields: result.fields, matchedTx, message: result.message });
}
