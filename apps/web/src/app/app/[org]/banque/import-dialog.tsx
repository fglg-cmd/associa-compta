"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Upload } from "lucide-react";
import { toast } from "sonner";
import { formatEUR } from "@associa/accounting";
import type { CsvMapping } from "@associa/bank-import";
import { importBankFile, previewBankImport, type ImportPreview } from "@/modules/bank/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn, fmtDate, fmtDateShort } from "@/lib/utils";

export function ImportDialog({
  orgId,
  bankAccounts,
  defaultAccountId,
  defaultOpen,
}: {
  orgId: string;
  bankAccounts: { id: string; name: string }[];
  defaultAccountId?: string;
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const [accountId, setAccountId] = useState(defaultAccountId ?? bankAccounts[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mapping, setMapping] = useState<CsvMapping | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setPreview(null);
      setMapping(null);
      setError(null);
    }
  }, [open]);

  function form(m: CsvMapping | null) {
    const fd = new FormData();
    fd.set("file", file!);
    if (m) fd.set("mapping", JSON.stringify(m));
    return fd;
  }

  function analyze(f: File, m: CsvMapping | null = null) {
    setFile(f);
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set("file", f);
      if (m) fd.set("mapping", JSON.stringify(m));
      const r = await previewBankImport(orgId, accountId, fd);
      if (!r.ok) {
        setPreview(null);
        return setError(r.error);
      }
      setPreview(r.data);
      setMapping(r.data.csv?.mapping ?? null);
    });
  }

  function confirm() {
    start(async () => {
      const r = await importBankFile(orgId, accountId, form(preview?.format === "csv" ? mapping : null));
      if (!r.ok) return setError(r.error);
      toast.success(`${r.data.inserted} mouvement(s) importé(s)`, {
        description: [
          r.data.matched ? `${r.data.matched} rapproché(s) d'une opération déjà saisie (facture).` : null,
          r.data.duplicates ? `${r.data.duplicates} doublon(s) ignoré(s) automatiquement.` : null,
        ].filter(Boolean).join(" ") || undefined,
      });
      setOpen(false);
      router.push(`?compte=${accountId}&vue=pending`);
      router.refresh();
    });
  }

  const headers = preview?.csv?.headers ?? [];
  const setCol = (k: keyof CsvMapping, v: string) => {
    if (!mapping && !headers.length) return;
    const next = { ...(mapping ?? { date: 0, label: 1, headerRow: -1, dateOrder: "dmy" as const }) } as CsvMapping;
    const n = v === "" ? undefined : Number(v);
    (next as unknown as Record<string, unknown>)[k] = n;
    if (k === "amount" && n !== undefined) { next.debit = undefined; next.credit = undefined; }
    if ((k === "debit" || k === "credit") && n !== undefined) next.amount = undefined;
    setMapping(next);
    if (file) analyze(file, next);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary"><Upload /> Importer un relevé</Button>
      </DialogTrigger>
      <DialogContent title="Importer un relevé bancaire" description="Fichiers CSV, OFX ou QIF exportés depuis votre banque en ligne. Les doublons sont détectés automatiquement." wide>
        <div className="grid gap-4">
          {bankAccounts.length > 1 && (
            <Field label="Compte bancaire">
              <Select value={accountId} onChange={(e) => { setAccountId(e.target.value); if (file) analyze(file, mapping); }}>
                {bankAccounts.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
          )}

          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) analyze(f); }}
            className={cn("flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-8 text-center transition-colors", drag ? "border-accent bg-accent-soft" : "border-border-strong hover:bg-surface-2")}
          >
            <FileUp className="size-6 text-muted" />
            <span className="text-sm font-medium">{file ? file.name : "Déposez votre fichier ici ou cliquez pour parcourir"}</span>
            <span className="text-xs text-muted">CSV · OFX · QIF — 5 Mo maximum</span>
          </button>
          <input ref={input} type="file" accept=".csv,.txt,.tsv,.ofx,.qfx,.qif" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) analyze(f); e.target.value = ""; }} />

          {preview?.format === "csv" && headers.length > 0 && (
            <div className="rounded-lg border border-border bg-surface-2/50 p-3">
              <p className="mb-2 text-xs font-medium text-muted">Colonnes détectées — corrigez si nécessaire</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {([
                  ["date", "Date"],
                  ["label", "Libellé"],
                  ["amount", "Montant signé"],
                  ["debit", "Débit"],
                  ["credit", "Crédit"],
                ] as const).map(([k, l]) => (
                  <Field key={k} label={<span className="text-xs">{l}</span>}>
                    <Select value={mapping?.[k] ?? ""} onChange={(e) => setCol(k, e.target.value)} className="h-7 text-xs">
                      <option value="">—</option>
                      {headers.map((h, i) => <option key={i} value={i}>{h || `Colonne ${i + 1}`}</option>)}
                    </Select>
                  </Field>
                ))}
                <Field label={<span className="text-xs">Format de date</span>}>
                  <Select value={mapping?.dateOrder ?? "dmy"} onChange={(e) => { const m = { ...mapping!, dateOrder: e.target.value as "dmy" | "mdy" }; setMapping(m); if (file) analyze(file, m); }} className="h-7 text-xs">
                    <option value="dmy">jj/mm/aaaa</option>
                    <option value="mdy">mm/jj/aaaa</option>
                  </Select>
                </Field>
              </div>
            </div>
          )}

          {preview && preview.total > 0 && (
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-[13px]">
                <Badge tone="accent">{preview.format.toUpperCase()}</Badge>
                <span><strong>{preview.total - preview.duplicates}</strong> nouveau(x) mouvement(s)</span>
                {preview.duplicates > 0 && <span className="text-muted">· {preview.duplicates} déjà importé(s)</span>}
                {preview.skipped > 0 && <span className="text-muted">· {preview.skipped} ligne(s) ignorée(s) (en-têtes, totaux)</span>}
                {preview.dateRange && <span className="text-muted">· du {fmtDate(preview.dateRange[0])} au {fmtDate(preview.dateRange[1])}</span>}
              </div>
              <div className="overflow-hidden rounded-lg border border-border">
                {preview.sample.map((t, i) => (
                  <div key={i} className={cn("flex items-center gap-3 border-b border-border px-3 py-2 text-[13px] last:border-0", t.duplicate && "opacity-50")}>
                    <span className="w-14 text-xs text-muted tabular">{fmtDateShort(t.date)}</span>
                    <span className="flex-1 truncate">{t.label}</span>
                    {t.duplicate && <Badge>doublon</Badge>}
                    <span className={cn("tabular font-medium", t.amount > 0 && "text-positive")}>{formatEUR(t.amount, { signed: true })}</span>
                  </div>
                ))}
              </div>
              {preview.total > preview.sample.length && <p className="mt-1.5 text-xs text-muted">… et {preview.total - preview.sample.length} autre(s).</p>}
            </div>
          )}

          {error && <p className="rounded-md bg-negative-soft px-3 py-2 text-[13px] text-negative">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button variant="primary" onClick={confirm} disabled={!preview || preview.total - preview.duplicates <= 0} loading={pending}>
            Importer {preview && preview.total - preview.duplicates > 0 ? `${preview.total - preview.duplicates} mouvement(s)` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
