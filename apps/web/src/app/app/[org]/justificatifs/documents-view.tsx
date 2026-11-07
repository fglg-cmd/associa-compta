"use client";
import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Download, FileImage, FileSpreadsheet, FileText, FolderOpen, Link2, Loader2, ReceiptText, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatEUR } from "@associa/accounting";
import { deleteDocument, getDocumentUrl, updateDocument } from "@/modules/documents/actions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import type { DocumentRow } from "@/lib/types";
import { cn, fmtDate, fmtDateShort, formatBytes } from "@/lib/utils";
import { DocumentOperation } from "./document-operation";

type Tx = { id: string; date: string; label: string; amount: number };

function iconFor(mime: string) {
  if (mime.startsWith("image/")) return FileImage;
  if (/sheet|excel/.test(mime)) return FileSpreadsheet;
  return FileText;
}

function Preview({ orgId, doc }: { orgId: string; doc: DocumentRow }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getDocumentUrl(orgId, doc.id).then((r) => alive && (r.ok ? setUrl(r.data) : setError(r.error)));
    return () => { alive = false; };
  }, [orgId, doc.id]);
  if (error) return <p className="text-[13px] text-negative">{error}</p>;
  if (!url) return <div className="grid h-[60vh] place-items-center rounded-lg bg-surface-2"><Loader2 className="size-5 animate-spin text-subtle" /></div>;
  if (doc.mime_type === "application/pdf") return <iframe src={url} title={doc.name} className="h-[60vh] w-full rounded-lg border border-border bg-white" />;
  // eslint-disable-next-line @next/next/no-img-element
  if (doc.mime_type.startsWith("image/") && doc.mime_type !== "image/heic") return <img src={url} alt={doc.name} className="max-h-[60vh] w-full rounded-lg border border-border object-contain bg-surface-2" />;
  return (
    <div className="grid h-40 place-items-center rounded-lg border border-dashed border-border text-center text-[13px] text-muted">
      <div>Aperçu non disponible pour ce format.<br /><a href={url} className="font-medium text-accent hover:underline">Télécharger le fichier</a></div>
    </div>
  );
}

export function DocumentsView({ orgId, docs, canWrite, folders, transactions, openId, openCreate, searching }: { orgId: string; docs: DocumentRow[]; canWrite: boolean; folders: string[]; transactions: Tx[]; openId?: string; openCreate?: boolean; searching: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<DocumentRow | null>(() => docs.find((d) => d.id === openId) ?? null);
  const [creating, setCreating] = useState(Boolean(openId && openCreate));
  useEffect(() => {
    const d = openId ? docs.find((x) => x.id === openId) : undefined;
    if (d) { setSelected(d); setCreating(Boolean(openCreate) && !d.entry_id && !d.bank_transaction_id); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, openCreate]);
  const pathname = usePathname();
  const close = () => {
    setSelected(null);
    setCreating(false);
    if (openId) router.replace(pathname); // ouvert depuis un lien : on revient à la liste complète
  };
  const [pending, start] = useTransition();
  const txById = new Map(transactions.map((t) => [t.id, t]));

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string, closeAfter = false) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(msg);
      if (closeAfter) close();
      router.refresh();
    });

  async function rerunOcr(id: string) {
    start(async () => {
      const res = await fetch(`/api/documents/${id}/ocr`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) toast.error(json.error ?? "Échec");
      else toast.success(json.status === "done" ? "Document relu" : json.message ?? "Analyse terminée");
      router.refresh();
    });
  }

  async function download(id: string) {
    const r = await getDocumentUrl(orgId, id, true);
    if (r.ok) window.location.href = r.data;
    else toast.error(r.error);
  }

  if (!docs.length) {
    return (
      <Card>
        <EmptyState icon={FolderOpen} title={searching ? "Aucun document trouvé" : "Aucun justificatif pour l'instant"} description={searching ? "La recherche porte sur le nom, le fournisseur et le texte lu dans les documents." : "Cliquez sur « Ajouter » ou prenez en photo un ticket : le montant, la date et le fournisseur sont lus automatiquement."} />
      </Card>
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        <ul className="divide-y divide-border">
          {docs.map((d) => {
            const Icon = iconFor(d.mime_type);
            const tx = d.bank_transaction_id ? txById.get(d.bank_transaction_id) : null;
            return (
              <li key={d.id}>
                <button onClick={() => setSelected(d)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2/50">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-surface-2"><Icon className="size-4 text-muted" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{d.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {d.folder} · {fmtDateShort(d.created_at)}{d.extracted_vendor ? ` · ${d.extracted_vendor}` : ""}
                    </span>
                  </span>
                  {d.ocr_status === "processing" && (Date.now() - new Date(d.created_at).getTime() < 3 * 60_000
                    ? <Badge><Loader2 className="size-3 animate-spin" /> Lecture</Badge>
                    : <Badge tone="warning">Lecture interrompue</Badge>)}
                  {d.ocr_status === "failed" && <Badge tone="warning">Illisible</Badge>}
                  {(d.bank_transaction_id || d.entry_id) ? <Badge tone="positive"><Link2 className="size-3" /> {tx ? `Rattaché au ${fmtDateShort(tx.date)}` : "Rattaché"}</Badge> : <Badge tone="warning">À rattacher</Badge>}
                  <span className="w-24 text-right text-[13px] font-medium tabular">{d.extracted_amount ? formatEUR(d.extracted_amount) : ""}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && close()}>
        {selected && (
          <DialogContent title={creating ? "Enregistrer l'opération" : selected.name} description={creating ? `D'après le justificatif « ${selected.name} »` : `${selected.folder} · ${formatBytes(selected.size_bytes)} · ajouté le ${fmtDate(selected.created_at)}`} wide>
            <div className={cn("grid gap-5", creating ? "md:grid-cols-[1fr_400px]" : "md:grid-cols-[1fr_260px]")}>
              <Preview orgId={orgId} doc={selected} />
              {creating ? (
                <DocumentOperation key={selected.id} orgId={orgId} docId={selected.id} onDone={() => setCreating(false)} onCreated={() => { setSelected(null); setCreating(false); if (openId) router.replace(pathname); else router.refresh(); }} />
              ) : (
              <div className="grid content-start gap-4 text-[13px]">
                {canWrite && !selected.entry_id && !selected.bank_transaction_id && (
                  <Button variant="primary" onClick={() => setCreating(true)}><ReceiptText /> Créer la dépense ou la recette</Button>
                )}
                {selected.entry_id && <p className="rounded-lg bg-positive-soft px-3 py-2 text-[12.5px] text-positive">Ce justificatif est rattaché à une opération enregistrée.</p>}
                <dl className="grid gap-2 rounded-lg border border-border p-3">
                  <div className="flex justify-between"><dt className="text-muted">Montant lu</dt><dd className="font-semibold tabular">{selected.extracted_amount ? formatEUR(selected.extracted_amount) : "—"}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted">Date</dt><dd>{selected.extracted_date ? fmtDate(selected.extracted_date) : "—"}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted">Fournisseur</dt><dd className="truncate text-right">{selected.extracted_vendor ?? "—"}</dd></div>
                </dl>
                {canWrite && (
                  <>
                    <Field label="Dossier">
                      <Select defaultValue={selected.folder} onChange={(e) => act(() => updateDocument(orgId, selected.id, { folder: e.target.value }), "Document classé")}>
                        {folders.map((f) => <option key={f}>{f}</option>)}
                      </Select>
                    </Field>
                    <Field label="Mouvement bancaire justifié">
                      <Select defaultValue={selected.bank_transaction_id ?? ""} onChange={(e) => act(() => updateDocument(orgId, selected.id, { txId: e.target.value || null }), e.target.value ? "Justificatif rattaché" : "Rattachement retiré")}>
                        <option value="">Aucun</option>
                        {transactions.map((t) => (
                          <option key={t.id} value={t.id}>{fmtDateShort(t.date)} · {t.label.slice(0, 32)} · {formatEUR(t.amount)}</option>
                        ))}
                      </Select>
                    </Field>
                  </>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => download(selected.id)}><Download /> Télécharger</Button>
                  {canWrite && <Button size="sm" variant="ghost" loading={pending} onClick={() => rerunOcr(selected.id)}><RefreshCw /> Relire</Button>}
                  {canWrite && <Button size="sm" variant="ghost" className="text-negative" onClick={() => { if (confirm("Supprimer définitivement ce document ?")) act(() => deleteDocument(orgId, selected.id), "Document supprimé", true); }}><Trash2 /> Supprimer</Button>}
                </div>
                {selected.ocr_status === "skipped" && <p className="text-xs text-muted">Ce document n&apos;a pas pu être lu automatiquement.</p>}
                {(selected.ocr_status === "failed" || (selected.ocr_status === "processing" && Date.now() - new Date(selected.created_at).getTime() >= 3 * 60_000)) && canWrite && (
                  <p className="rounded-md bg-warning-soft px-2.5 py-2 text-xs text-warning">La lecture automatique n&apos;a pas abouti. Cliquez sur « Relire » pour réessayer.</p>
                )}
              </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
      {pending && <span className={cn("sr-only")}>Chargement</span>}
    </>
  );
}
