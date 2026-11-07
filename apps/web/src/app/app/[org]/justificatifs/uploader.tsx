"use client";
import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CheckCircle2, FileUp, Loader2, ReceiptText, Undo2, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { formatEUR } from "@associa/accounting";
import { getBrowserClient } from "@/lib/supabase/browser";
import { prepareUpload, registerDocument, undoDocumentOperation, type AutoOperation } from "@/modules/documents/actions";
import { ALLOWED_MIME } from "@/modules/documents/constants";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/input";
import { cn, formatBytes } from "@/lib/utils";
import { compressImage } from "@/lib/image-compress";

type Item = { file: File; state: "queued" | "uploading" | "reading" | "done" | "error"; message?: string; docId?: string; canCreate?: boolean; created?: boolean };

export function Uploader({ orgId, folders, defaultFolder, txId, defaultOpen }: { orgId: string; folders: string[]; defaultFolder: string; txId?: string; defaultOpen?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const [items, setItems] = useState<Item[]>([]);
  const [folder, setFolder] = useState(defaultFolder);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const add = (files: FileList | File[]) => setItems((cur) => [...cur, ...[...files].map((file) => ({ file, state: "queued" as const }))]);
  const update = (i: number, patch: Partial<Item>) => setItems((cur) => cur.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  /** Envoie un document puis lance sa lecture automatique. */
  async function processOne(i: number, supabase: ReturnType<typeof getBrowserClient>) {
    const original = items[i]!;
    update(i, { state: "uploading" });
    const file = await compressImage(original.file);
    const mime = file.type || "application/octet-stream";
    const prep = await prepareUpload(orgId, { name: file.name, size: file.size, mime });
    if (!prep.ok) { update(i, { state: "error", message: prep.error }); return; }
    const up = await supabase.storage.from("documents").upload(prep.data.path, file, { contentType: mime, upsert: false });
    if (up.error) { update(i, { state: "error", message: up.error.message }); return; }
    const reg = await registerDocument(orgId, { id: prep.data.id, name: file.name, path: prep.data.path, mime, size: file.size, folder, txId: i === 0 && txId ? txId : null });
    if (!reg.ok) { update(i, { state: "error", message: reg.error }); return; }
    update(i, { state: "reading", docId: prep.data.id });
    try {
      const res = await fetch(`/api/documents/${prep.data.id}/ocr`, { method: "POST" });
      const json = (await res.json()) as { status: string; fields?: { amount: number | null; vendor: string | null }; matchedTx?: string | null; operation?: AutoOperation | null; linked?: boolean; message?: string };
      const op = json.operation;
      if (op?.created) {
        update(i, { state: "done", created: true, message: `${op.direction === "in" ? "Recette" : "Dépense"} enregistrée · ${formatEUR(op.amount)} · ${op.category}` });
      } else if (json.linked) {
        update(i, { state: "done", message: "Justificatif rattaché au mouvement bancaire" });
      } else if (json.matchedTx) {
        update(i, { state: "done", message: [json.fields?.vendor, json.fields?.amount ? formatEUR(json.fields.amount) : null, "rattaché au mouvement bancaire"].filter(Boolean).join(" · ") });
      } else {
        update(i, { state: "done", canCreate: true, message: json.status === "done" ? op?.reason ?? "Document lu" : json.message });
      }
    } catch {
      update(i, { state: "done", message: "Enregistré (lecture automatique indisponible)", canCreate: true });
    }
  }

  async function uploadAll() {
    setBusy(true);
    const supabase = getBrowserClient();
    // Trois documents traités en même temps (au lieu d'un par un).
    const queue = items.map((it, i) => (it.state === "queued" ? i : -1)).filter((i) => i >= 0);
    const runners = Array.from({ length: Math.min(3, queue.length) }, async () => {
      for (let next = queue.shift(); next !== undefined; next = queue.shift()) await processOne(next, supabase);
    });
    await Promise.all(runners);
    setBusy(false);
    router.refresh();
    toast.success("Documents enregistrés");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setItems([]); }}>
      <DialogTrigger asChild><Button variant="primary"><Upload /> Ajouter</Button></DialogTrigger>
      <DialogContent title="Ajouter des documents" description="Déposez vos factures et tickets (PDF ou photo) : chacun est lu et devient automatiquement une dépense, ou une recette si l'association l'a émis.">
        <div className="grid gap-4">
          <Field label="Dossier">
            <Select value={folder} onChange={(e) => setFolder(e.target.value)}>
              {folders.map((f) => <option key={f}>{f}</option>)}
            </Select>
          </Field>
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
            className={cn("flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-8 text-center", drag ? "border-accent bg-accent-soft" : "border-border-strong hover:bg-surface-2")}
          >
            <FileUp className="size-6 text-muted" />
            <span className="text-sm font-medium">Déposez vos fichiers ou cliquez pour parcourir</span>
            <span className="text-xs text-muted">Photographiez un ticket avec votre téléphone : ça marche aussi.</span>
          </button>
          <input ref={input} type="file" multiple accept={Object.keys(ALLOWED_MIME).join(",")} capture={undefined} className="hidden" onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = ""; }} />
          {items.length > 0 && (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {items.map((it, i) => (
                <li key={i} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                  {it.state === "done" ? <CheckCircle2 className="size-4 text-positive" /> : it.state === "error" ? <XCircle className="size-4 text-negative" /> : it.state === "queued" ? <FileUp className="size-4 text-subtle" /> : <Loader2 className="size-4 animate-spin text-accent" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{it.file.name}</span>
                    <span className={cn("block truncate text-xs", it.state === "error" ? "text-negative" : it.created ? "font-medium text-positive" : "text-muted")}>
                      {it.message ?? (it.state === "uploading" ? "Envoi…" : it.state === "reading" ? "Lecture du montant, de la date et du fournisseur…" : formatBytes(it.file.size))}
                    </span>
                  </span>
                  {it.state === "done" && it.created && it.docId && (
                    <Button size="sm" variant="ghost" onClick={async () => {
                      const r = await undoDocumentOperation(orgId, it.docId!);
                      if (!r.ok) { toast.error(r.error); return; }
                      update(i, { created: false, canCreate: true, message: "Opération annulée : saisissez-la vous-même" });
                      router.refresh();
                    }}>
                      <Undo2 /> Annuler
                    </Button>
                  )}
                  {it.state === "done" && it.canCreate && it.docId && (
                    <Button size="sm" variant="primary" disabled={busy} onClick={() => { setOpen(false); setItems([]); router.push(`${pathname}?doc=${it.docId}&creer=1`); }}>
                      <ReceiptText /> Compléter
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Fermer</Button>
          <Button variant="primary" onClick={uploadAll} loading={busy} disabled={!items.some((i) => i.state === "queued")}>Envoyer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
