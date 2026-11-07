"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatEUR, parseAmount, validateEntry } from "@associa/accounting";
import { createExpertEntry, createSimpleEntry } from "@/modules/accounting/actions";
import { AccountSelect } from "@/components/finance/account-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Account, Journal, Project } from "@/lib/types";
import { cn, todayISO } from "@/lib/utils";

type Acc = Pick<Account, "id" | "number" | "label" | "is_active">;

function clampDate(min: string, max: string) {
  const t = todayISO();
  return t < min ? min : t > max ? max : t;
}

export interface SimpleInitial {
  direction?: "in" | "out";
  label?: string;
  amount?: number | null;
  date?: string;
  categoryAccountId?: string;
  reference?: string;
  paymentAccountId?: string;
}

const centsToInput = (c: number) => (c / 100).toFixed(2).replace(".", ",");

export function SimpleForm({ orgId, accounts, treasury, projects, onDone, minDate, maxDate, initial, documentId, onCreated }: { orgId: string; accounts: Acc[]; treasury: { id: string; label: string }[]; projects: Pick<Project, "id" | "name">[]; onDone: () => void; minDate: string; maxDate: string; initial?: SimpleInitial; documentId?: string; onCreated?: (entryId: string) => void }) {
  const [direction, setDirection] = useState<"in" | "out">(initial?.direction ?? "out");
  const [category, setCategory] = useState(initial?.categoryAccountId ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <form
      action={(fd) =>
        start(async () => {
          fd.set("direction", direction);
          fd.set("categoryAccountId", category);
          if (documentId) fd.set("documentId", documentId);
          const r = await createSimpleEntry(orgId, fd);
          if (!r.ok) return setError(r.error);
          toast.success(direction === "in" ? "Recette enregistrée" : "Dépense enregistrée");
          onCreated?.(r.data);
          onDone();
          router.refresh();
        })
      }
      className="grid gap-3"
    >
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface-2 p-1">
        {(["out", "in"] as const).map((d) => (
          <button key={d} type="button" onClick={() => { setDirection(d); setCategory(""); }} className={cn("rounded-md py-1.5 text-[13px] font-medium", direction === d ? "bg-surface shadow-sm" : "text-muted")}>
            {d === "out" ? "Dépense" : "Recette"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[1fr_140px] gap-3">
        <Field label="Libellé" htmlFor="s-label"><Input id="s-label" name="label" required defaultValue={initial?.label} placeholder={direction === "out" ? "Achat de ballons" : "Recette buvette"} /></Field>
        <Field label="Montant" htmlFor="s-amount"><Input id="s-amount" name="amount" required inputMode="decimal" defaultValue={initial?.amount ? centsToInput(initial.amount) : undefined} placeholder="0,00 €" className="text-right tabular" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" htmlFor="s-date"><Input id="s-date" name="date" type="date" required defaultValue={initial?.date ?? clampDate(minDate, maxDate)} min={minDate} max={maxDate} /></Field>
        <Field label={direction === "out" ? "Payé depuis" : "Encaissé sur"}>
          <Select name="paymentAccountId" required defaultValue={initial?.paymentAccountId || treasury[0]?.id}>
            {treasury.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Catégorie"><AccountSelect accounts={accounts} direction={direction} value={category} onChange={setCategory} required onlyClasses={undefined} exclude={treasury.map((t) => t.id)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        {projects.length > 0 && (
          <Field label="Projet">
            <Select name="projectId" defaultValue="">
              <option value="">Aucun</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Référence" htmlFor="s-ref" hint="N° de facture, de chèque…"><Input id="s-ref" name="reference" defaultValue={initial?.reference} /></Field>
      </div>
      {error && <p className="text-[13px] text-negative">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>Annuler</Button>
        <Button type="submit" variant="primary" loading={pending}>Enregistrer</Button>
      </DialogFooter>
    </form>
  );
}

interface Line { accountId: string; label: string; debit: string; credit: string }

function ExpertForm({ orgId, accounts, journals, onDone, minDate, maxDate }: { orgId: string; accounts: Acc[]; journals: Journal[]; onDone: () => void; minDate: string; maxDate: string }) {
  const [lines, setLines] = useState<Line[]>([
    { accountId: "", label: "", debit: "", credit: "" },
    { accountId: "", label: "", debit: "", credit: "" },
  ]);
  const [journalId, setJournalId] = useState(journals.find((j) => j.code === "OD")?.id ?? journals[0]?.id ?? "");
  const [date, setDate] = useState(clampDate(minDate, maxDate));
  const [label, setLabel] = useState("");
  const [reference, setReference] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const parsed = lines.map((l) => ({ accountId: l.accountId, debit: parseAmount(l.debit) ?? 0, credit: parseAmount(l.credit) ?? 0 }));
  const totalD = parsed.reduce((t, l) => t + l.debit, 0);
  const totalC = parsed.reduce((t, l) => t + l.credit, 0);
  const check = validateEntry(parsed);

  const set = (i: number, patch: Partial<Line>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  function submit(post: boolean) {
    if (!label.trim()) return setError("Indiquez un libellé.");
    if (!check.ok) return setError(check.error);
    start(async () => {
      const r = await createExpertEntry(orgId, {
        journalId,
        date,
        label,
        reference,
        post,
        lines: lines.map((l, i) => ({ accountId: l.accountId, label: l.label, debit: parsed[i]!.debit, credit: parsed[i]!.credit })).filter((l) => l.accountId && (l.debit || l.credit)),
      });
      if (!r.ok) return setError(r.error);
      toast.success(post ? "Écriture validée" : "Brouillon enregistré");
      onDone();
      router.refresh();
    });
  }

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-[120px_150px_1fr] gap-3">
        <Field label="Journal">
          <Select value={journalId} onChange={(e) => setJournalId(e.target.value)}>
            {journals.map((j) => <option key={j.id} value={j.id}>{j.code} · {j.label}</option>)}
          </Select>
        </Field>
        <Field label="Date"><Input type="date" value={date} min={minDate} max={maxDate} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Libellé"><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Affectation du résultat" /></Field>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[620px] text-[13px]">
          <thead className="bg-surface-2 text-xs text-muted">
            <tr><th className="px-2 py-1.5 text-left font-medium">Compte</th><th className="px-2 text-left font-medium">Libellé</th><th className="w-28 px-2 text-right font-medium">Débit</th><th className="w-28 px-2 text-right font-medium">Crédit</th><th className="w-8" /></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lines.map((l, i) => (
              <tr key={i}>
                <td className="p-1.5"><AccountSelect accounts={accounts} value={l.accountId} onChange={(v) => set(i, { accountId: v })} className="h-7 text-[13px]" placeholder="Compte…" /></td>
                <td className="p-1.5"><Input value={l.label} onChange={(e) => set(i, { label: e.target.value })} className="h-7" /></td>
                <td className="p-1.5"><Input value={l.debit} onChange={(e) => set(i, { debit: e.target.value, credit: e.target.value ? "" : l.credit })} inputMode="decimal" className="h-7 text-right tabular" /></td>
                <td className="p-1.5"><Input value={l.credit} onChange={(e) => set(i, { credit: e.target.value, debit: e.target.value ? "" : l.debit })} inputMode="decimal" className="h-7 text-right tabular" /></td>
                <td className="p-1.5">{lines.length > 2 && <Button size="icon-sm" variant="ghost" onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label="Supprimer la ligne"><Trash2 /></Button>}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-border bg-surface-2 text-xs">
            <tr>
              <td className="px-2 py-1.5" colSpan={2}>
                <Button size="sm" variant="ghost" onClick={() => setLines([...lines, { accountId: "", label: "", debit: "", credit: "" }])}><Plus /> Ligne</Button>
              </td>
              <td className="px-2 text-right font-semibold tabular">{formatEUR(totalD)}</td>
              <td className="px-2 text-right font-semibold tabular">{formatEUR(totalC)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex items-center justify-between text-[13px]">
        {totalD === totalC && totalD > 0 ? <span className="text-positive">Écriture équilibrée</span> : <span className="flex items-center gap-1 text-warning"><Minus className="size-3.5" /> Écart : {formatEUR(totalD - totalC)}</span>}
        <Field label="" className="w-48"><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Référence (facultatif)" className="h-7" /></Field>
      </div>
      {error && <p className="text-[13px] text-negative">{error}</p>}
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>Annuler</Button>
        <Button onClick={() => submit(false)} loading={pending}>Enregistrer en brouillon</Button>
        <Button variant="primary" onClick={() => submit(true)} loading={pending} disabled={!check.ok}>Valider l&apos;écriture</Button>
      </DialogFooter>
    </div>
  );
}

export function EntryDialog(props: {
  orgId: string;
  accounts: Acc[];
  journals: Journal[];
  treasury: { id: string; label: string }[];
  projects: Pick<Project, "id" | "name">[];
  defaultOpen?: boolean;
  minDate: string;
  maxDate: string;
}) {
  const [open, setOpen] = useState(Boolean(props.defaultOpen));
  const done = () => setOpen(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="primary"><Plus /> Nouvelle opération</Button></DialogTrigger>
      <DialogContent title="Nouvelle opération" description="Une recette ou une dépense hors relevé bancaire (espèces, chèque à encaisser…)." wide>
        <Tabs defaultValue="simple">
          <TabsList className="mb-4">
            <TabsTrigger value="simple">Recette / dépense</TabsTrigger>
            <TabsTrigger value="expert">Écriture comptable</TabsTrigger>
          </TabsList>
          <TabsContent value="simple"><SimpleForm {...props} onDone={done} /></TabsContent>
          <TabsContent value="expert"><ExpertForm {...props} onDone={done} /></TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
