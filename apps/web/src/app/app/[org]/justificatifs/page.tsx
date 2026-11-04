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
    supabase.from("documents").select("folder").eq("organization_id", org.id),
    supabase.from("bank_transactions").select("id, date, label, amount").eq("organization_id", org.id).lt("amount", 0).neq("status", "ignored").order("date", { ascending: false }).limit(300),
  ]);
  const counts = new Map<string, number>();
  for (const r of folderRows ?? []) counts.set(r.folder as string, (counts.get(r.folder as string) ?? 0) + 1);
  const folders = [...new Set([...DEFAULT_FOLDERS, ...counts.keys()])];
  const total = folderRows?.length ?? 0;
  const base = `/app/${slug}/justificatifs`;
  const pill = (active: boolean) => cn("flex items-center justify-between rounded-md px-2.5 py-1.5 text-[13px]", active ? "bg-surface font-medium shadow-xs border border-border" : "border border-transparent text-muted hover:bg-surface-2 hover:text-foreground");

  return (
    <>
      <PageHeader
        title="Justificatifs"
        description="Factures, reçus, statuts, PV d'AG : tout est stocké, lu automatiquement et retrouvable en quelques secondes."
        actions={canWrite && <Uploader orgId={org.id} folders={folders} defaultFolder={sp.dossier ?? "Justificatifs"} txId={sp.tx} defaultOpen={sp.action === "ajouter"} />}
      />
      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <aside className="grid content-start gap-0.5">
          <Link href={base} className={pill(!sp.dossier && !sp.filtre)}>Tous <span className="text-xs tabular">{total}</span></Link>
          <Link href={`${base}?filtre=non-rattaches`} className={pill(sp.filtre === "non-rattaches")}>Non rattachés</Link>
          <div className="my-2 h-px bg-border" />
          {folders.map((f) => (
            <Link key={f} href={`${base}?dossier=${encodeURIComponent(f)}`} className={pill(sp.dossier === f)}>
              <span className="truncate">{f}</span>
              {counts.get(f) ? <span className="text-xs tabular">{counts.get(f)}</span> : null}
            </Link>
          ))}
        </aside>
        <div>
          <form action={base} className="mb-4">
            <input name="q" defaultValue={sp.q} placeholder="Rechercher dans le contenu des documents : « assurance 2026 », « leroy merlin »…" className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm shadow-xs focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15" />
          </form>
          <DocumentsView
            orgId={org.id}
            docs={docs}
            canWrite={canWrite}
            folders={folders}
            transactions={(txs ?? []) as { id: string; date: string; label: string; amount: number }[]}
            openId={sp.doc}
            searching={Boolean(sp.q)}
          />
        </div>
      </div>
    </>
  );
}
