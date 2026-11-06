import Link from "next/link";
import { getOrgContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/misc";
import type { DocumentRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DEFAULT_FOLDERS } from "@/modules/documents/constants";
import { DocumentsView } from "./documents-view";
import { Uploader } from "./uploader";

export const metadata = { title: "Justificatifs" };

export default async function DocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ dossier?: string; q?: string; filtre?: string; action?: string; tx?: string; doc?: string }>;
}) {
  const { org: slug } = await params;
  const sp = await searchParams;
  const { org, canWrite } = await getOrgContext(slug);
  const supabase = await createClient();

  let docs: DocumentRow[];
  if (sp.q && sp.q.trim().length >= 2) {
    const { data } = await supabase.rpc("search_documents", { p_org: org.id, p_query: sp.q.trim(), p_limit: 100 });
    docs = (data ?? []) as DocumentRow[];
  } else {
    let q = supabase.from("documents").select("id, organization_id, name, storage_path, mime_type, size_bytes, folder, tags, ocr_status, extracted_amount, extracted_date, extracted_vendor, entry_id, bank_transaction_id, created_at").eq("organization_id", org.id);
    if (sp.doc) q = q.eq("id", sp.doc);
    if (sp.dossier) q = q.eq("folder", sp.dossier);
    if (sp.filtre === "non-rattaches") q = q.is("bank_transaction_id", null).is("entry_id", null);
    const { data } = await q.order("created_at", { ascending: false }).limit(300);
    docs = (data ?? []) as DocumentRow[];
  }

  const [{ data: folderRows }, { data: txs }] = await Promise.all([
    supabase.from("documents").select("folder, bank_transaction_id, entry_id").eq("organization_id", org.id),
    supabase.from("bank_transactions").select("id, date, label, amount").eq("organization_id", org.id).lt("amount", 0).neq("status", "ignored").order("date", { ascending: false }).limit(300),
  ]);
  const counts = new Map<string, number>();
  for (const r of folderRows ?? []) counts.set(r.folder as string, (counts.get(r.folder as string) ?? 0) + 1);
  const folders = [...new Set([...DEFAULT_FOLDERS, ...counts.keys()])];
  const total = folderRows?.length ?? 0;
  const unlinked = (folderRows ?? []).filter((r) => !r.bank_transaction_id && !r.entry_id).length;
  const usedFolders = folders.filter((f) => counts.get(f));
  const base = `/app/${slug}/justificatifs`;
  const tab = (active: boolean) => cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] font-medium", active ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground");
  const chip = (active: boolean) => cn("rounded-full border px-3 py-1 text-[12.5px]", active ? "border-foreground bg-foreground text-background" : "border-border text-muted hover:text-foreground");

  return (
    <>
      <PageHeader
        title="Justificatifs"
        description="Factures et reçus : déposez-les, ils sont lus et rattachés à vos dépenses."
        actions={canWrite && <Uploader orgId={org.id} folders={folders} defaultFolder={sp.dossier ?? "Justificatifs"} txId={sp.tx} defaultOpen={sp.action === "ajouter"} />}
      />
      {total > 0 && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5">
              <Link href={base} className={tab(!sp.filtre)}>Tous <span className="text-xs text-subtle tabular">{total}</span></Link>
              <Link href={`${base}?filtre=non-rattaches`} className={tab(sp.filtre === "non-rattaches")}>À rattacher <span className="text-xs text-subtle tabular">{unlinked}</span></Link>
            </div>
            <form action={base} className="ml-auto">
              <input name="q" defaultValue={sp.q} placeholder="Rechercher dans vos documents…" className="h-8 w-64 rounded-md border border-border bg-surface px-2.5 text-sm shadow-xs focus:border-accent focus:outline-none" />
            </form>
          </div>
          {usedFolders.length > 1 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {usedFolders.map((f) => (
                <Link key={f} href={sp.dossier === f ? base : `${base}?dossier=${encodeURIComponent(f)}`} className={chip(sp.dossier === f)}>
                  {f} <span className="opacity-60 tabular">{counts.get(f)}</span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
      <DocumentsView
        orgId={org.id}
        docs={docs}
        canWrite={canWrite}
        folders={folders}
        transactions={(txs ?? []) as { id: string; date: string; label: string; amount: number }[]}
        openId={sp.doc}
        searching={Boolean(sp.q)}
      />
    </>
  );
}
