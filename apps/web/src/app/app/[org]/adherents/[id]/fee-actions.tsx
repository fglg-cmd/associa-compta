"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellRing, MoreHorizontal, Plus, Wallet, XCircle } from "lucide-react";
import { toast } from "sonner";
import { formatEUR } from "@associa/accounting";
import { cancelFee, createFee, recordPayment, sendReminders } from "@/modules/members/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { Field, Input, Select } from "@/components/ui/input";
import type { FeeType } from "@/lib/types";
import { fmtDateShort, todayISO } from "@/lib/utils";

export function FeeActions({ orgId, fee, hasEmail, emailEnabled, bankAccounts, pendingTx }: { orgId: string; fee: { id: string; label: string; remaining: number }; hasEmail: boolean; emailEnabled: boolean; bankAccounts: { id: string; name: string }[]; pendingTx: { id: string; date: string; label: string; amount: number }[] }) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<"transfer" | "cash" | "cheque" | "card" | "other">("transfer");
  const [txId, setTxId] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const matching = pendingTx.filter((t) => t.amount === fee.remaining);
  const tx = pendingTx.find((t) => t.id === txId);

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(msg);
      router.refresh();
    });

  return (
    <div className="flex gap-1">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button size="sm" variant="primary"><Wallet /> Encaisser</Button></DialogTrigger>
        <DialogContent title="Enregistrer un paiement" description={`${fee.label} — reste ${formatEUR(fee.remaining)}`}>
          <form
            action={(fd) =>
              start(async () => {
                fd.set("method", method);
                fd.set("bankTxId", txId);
                if (tx) { fd.set("amount", String(tx.amount / 100)); fd.set("date", tx.date); }
                const r = await recordPayment(orgId, fee.id, fd);
                if (!r.ok) return setError(r.error);
                toast.success("Paiement enregistré et comptabilisé");
                setOpen(false);
                router.refresh();
              })
            }
            className="grid gap-3"
          >
            <Field label="Moyen de paiement">
              <Select value={method} onChange={(e) => { setMethod(e.target.value as typeof method); setTxId(""); }}>
                <option value="transfer">Virement</option>
                <option value="cheque">Chèque</option>
                <option value="cash">Espèces</option>
                <option value="card">Carte (HelloAsso, SumUp…)</option>
                <option value="other">Autre</option>
              </Select>
            </Field>
            {method !== "cash" && pendingTx.length > 0 && (
              <Field label="Mouvement bancaire correspondant" hint={matching.length ? `${matching.length} mouvement(s) du montant exact trouvé(s).` : "Le paiement sera rapproché lors de l'import du relevé."}>
                <Select value={txId} onChange={(e) => setTxId(e.target.value)}>
                  <option value="">Pas encore sur le relevé</option>
                  {[...matching, ...pendingTx.filter((t) => !matching.includes(t))].slice(0, 60).map((t) => (
                    <option key={t.id} value={t.id}>{fmtDateShort(t.date)} · {t.label.slice(0, 36)} · {formatEUR(t.amount)}</option>
                  ))}
                </Select>
              </Field>
            )}
            {!tx && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Montant"><Input name="amount" inputMode="decimal" defaultValue={(fee.remaining / 100).toFixed(2).replace(".", ",")} required className="text-right" /></Field>
                <Field label="Date"><Input name="date" type="date" defaultValue={todayISO()} required /></Field>
              </div>
            )}
            {!tx && method !== "cash" && bankAccounts.length > 1 && (
              <Field label="Compte bancaire">
                <Select name="bankAccountId">{bankAccounts.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select>
              </Field>
            )}
            {error && <p className="text-[13px] text-negative">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" variant="primary" loading={pending}>Enregistrer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button size="icon-sm" variant="ghost" aria-label="Plus d'actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
        <DropdownMenuContent>
          {emailEnabled && (<DropdownMenuItem disabled={!hasEmail || pending} onSelect={() => act(async () => { const r = await sendReminders(orgId, [fee.id]); return r.ok && r.data.sent === 0 ? { ok: false, error: "Déjà relancé dans les 7 derniers jours." } : r; }, "Relance envoyée")}>
            <BellRing /> {hasEmail ? "Envoyer une relance" : "Relance (e-mail manquant)"}
          </DropdownMenuItem>)}
          <DropdownMenuItem destructive onSelect={() => act(() => cancelFee(orgId, fee.id), "Cotisation annulée")}><XCircle /> Annuler la cotisation</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function NewFeeDialog({ orgId, memberId, feeTypes }: { orgId: string; memberId: string; feeTypes: FeeType[] }) {
  const [open, setOpen] = useState(false);
  const [typeId, setTypeId] = useState(feeTypes[0]?.id ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const type = feeTypes.find((t) => t.id === typeId);
  const y = new Date().getFullYear();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="primary"><Plus /> Cotisation</Button></DialogTrigger>
      <DialogContent title="Nouvelle cotisation">
        <form
          action={(fd) =>
            start(async () => {
              fd.set("feeTypeId", typeId);
              const r = await createFee(orgId, memberId, fd);
              if (!r.ok) return setError(r.error);
              toast.success("Cotisation créée");
              setOpen(false);
              router.refresh();
            })
          }
          className="grid gap-3"
        >
          {feeTypes.length > 0 && (
            <Field label="Tarif">
              <Select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
                {feeTypes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                <option value="">Montant libre</option>
              </Select>
            </Field>
          )}
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <Field label="Libellé"><Input name="label" required defaultValue={`Saison ${y}`} /></Field>
            <Field label="Montant"><Input name="amount" required inputMode="decimal" key={typeId} defaultValue={type?.amount ? (type.amount / 100).toFixed(2).replace(".", ",") : ""} className="text-right" /></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Début"><Input name="periodStart" type="date" defaultValue={`${y}-01-01`} required /></Field>
            <Field label="Fin"><Input name="periodEnd" type="date" defaultValue={`${y}-12-31`} required /></Field>
            <Field label="Échéance"><Input name="dueDate" type="date" defaultValue={todayISO()} required /></Field>
          </div>
          {error && <p className="text-[13px] text-negative">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" variant="primary" loading={pending}>Créer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
