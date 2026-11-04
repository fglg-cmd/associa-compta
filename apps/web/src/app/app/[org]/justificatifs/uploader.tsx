"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileUp, Loader2, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { formatEUR } from "@associa/accounting";
import { getBrowserClient } from "@/lib/supabase/browser";
import { prepareUpload, registerDocument } from "@/modules/documents/actions";
import { ALLOWED_MIME } from "@/modules/documents/constants";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/input";
import { cn, formatBytes } from "@/lib/utils";

type Item = { file: File; state: "queued" | "uploading" | "reading" | "done" | "error"; message?: string };

export function Uploader({ orgId, folders, defaultFolder, txId, defaultOpen }: { orgId: string; folders: string[]; defaultFolder: string; txId?: string; defaultOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const [items, setItems] = useState<Item[]>([]);
  const [folder, setFolder] = useState(defaultFolder);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const add = (files: FileList | File[]) => setItems((cur) => [...cur, ...[...files].map((file) => ({ file, state: "queued" as const }))]);
  const update = (i: number, patch: Partial<Item>) => setItems((cur) => cur.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  async function uploadAll() {
    setBusy(true);
    const supabase = getBrowserClient();
    for (let i = 0; i < items.length; i++) {
      const it = items[i]!;
      if (it.state !== "queued") continue;
      const mime = it.file.type || "application/octet-stream";
      update(i, { state: "uploading" });
      const prep = await prepareUpload(orgId, { name: it.file.name, size: it.file.size, mime });
      if (!prep.ok) { update(i, { state: "error", message: prep.error }); continue; }
      const up = await supabase.storage.from("documents").upload(prep.data.path, it.file, { contentType: mime, upsert: false });
      if (up.error) { update(i, { state: "error", message: up.error.message }); continue; }
      const reg = await registerDocument(orgId, { id: prep.data.id, name: it.file.name, path: prep.data.path, mime, size: it.file.size, folder, txId: i === 0 && txId ? txId : null });
      if (!reg.ok) { update(i, { state: "error", message: reg.error }); continue; }
      update(i, { state: "reading" });
      try {
        const res = await fetch(`/api/documents/${prep.data.id}/ocr`, { method: "POST" });
        const json = (await res.json()) as { status: string; fields?: { amount: number | null; vendor: string | null }; matchedTx?: string | null; message?: string };
        const bits = [json.fields?.vendor, json.fields?.amount ? formatEUR(json.fields.amount) : null, json.matchedTx ? "rattaché au mouvement bancaire" : null].filter(Boolean);
        update(i, { state: "done", message: json.status === "done" ? bits.join(" · ") || "Texte indexé" : json.message });
      } catch {
        update(i, { state: "done", message: "Enregistré (lecture automatique indisponible)" });
      }
    }
    setBusy(false);
    router.refresh();
    toast.success("Documents enregistrés");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setItems([]); }}>
      <DialogTrigger asChild><Button variant="primary"><Upload /> Ajouter</Button></DialogTrigger>
      <DialogContent title="Ajouter des documents" description="PDF, photos, Word ou Excel — 25 Mo par fichier. Le montant, la date et le fournisseur sont lus automatiquement.">
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
                    <span className={cn("block truncate text-xs", it.state === "error" ? "text-negative" : "text-muted")}>
                      {it.message ?? (it.state === "uploading" ? "Envoi…" : it.state === "reading" ? "Lecture automatique…" : formatBytes(it.file.size))}
                    </span>
                  </span>
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
