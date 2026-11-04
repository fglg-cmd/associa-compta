"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellRing, FileUp, Receipt } from "lucide-react";
import { toast } from "sonner";
import { formatEUR } from "@associa/accounting";
import { importMembers, issueFees, saveFeeType, sendReminders } from "@/modules/members/actions";
import { AccountSelect } from "@/components/finance/account-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import type { Account, FeeType } from "@/lib/types";

export function ImportMembersDialog({ orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="ghost"><FileUp /> Importer</Button></DialogTrigger>
      <DialogContent title="Importer des adhérents" description="Fichier CSV (exporté depuis Excel, Google Sheets ou HelloAsso) avec une ligne d'en-tête.">
        <form
          action={(fd) =>
            start(async () => {
              const r = await importMembers(orgId, fd);
              if (!r.ok) return setError(r.error);
              toast.success(`${r.data.imported} adhérent(s) importé(s)`, { description: r.data.skipped ? `${r.data.skipped} ligne(s) ignorée(s) (doublons ou incomplètes).` : undefined });
              setOpen(false);
              router.refresh();
            })
          }
          className="grid gap-3"
        >
          <p className="text-[13px] text-muted">Colonnes reconnues : <strong className="text-foreground">Prénom, Nom</strong> (obligatoires), E-mail, Téléphone, Adresse, Code postal, Ville, Date de naissance, Date d&apos;adhésion.</p>
          <Input type="file" name="file" accept=".csv,.txt" required className="h-auto py-1.5" />
          {error && <p className="text-[13px] text-negative">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" variant="primary" loading={pending}>Importer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function FeesToolbar({ orgId, feeTypes, accounts, overdueCount }: { orgId: string; feeTypes: FeeType[]; accounts: Pick<Account, "id" | "number" | "label" | "is_active">[]; overdueCount: number }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [typeId, setTypeId] = useState(feeTypes[0]?.id ?? "");
  const [accountId, setAccountId] = useState(accounts.find((a) => a.number === "756")?.id ?? "");
  const router = useRouter();
  const year = new Date().getFullYear();
  const type = feeTypes.find((t) => t.id === typeId);

  return (
    <>
      {overdueCount > 0 && (
        <Button
          variant="ghost"
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await sendReminders(orgId, "overdue");
              if (!r.ok) { toast.error(r.error); return; }
              toast.success(`${r.data.sent} relance(s) envoyée(s)`, { description: r.data.skipped ? `${r.data.skipped} ignorée(s) : sans e-mail ou déjà relancée(s) cette semaine.` : undefined });
              router.refresh();
            })
          }
        >
          <BellRing /> Relancer les retards ({overdueCount})
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button><Receipt /> Appel de cotisations</Button></DialogTrigger>
        <DialogContent title="Appel de cotisations" description="Crée une cotisation à régler pour chaque adhérent actif (sans doublon pour la même période).">
          <div className="grid gap-4">
            <form
              action={(fd) =>
                start(async () => {
                  fd.set("accountId", accountId);
                  const r = await saveFeeType(orgId, typeId || null, fd);
                  if (!r.ok) return setError(r.error);
                  toast.success("Tarif enregistré");
                  router.refresh();
                })
              }
              className="grid gap-3 rounded-lg border border-border p-3"
            >
              <p className="text-xs font-medium text-muted">Tarif</p>
              {feeTypes.length > 0 && (
                <Select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
                  {feeTypes.map((t) => <option key={t.id} value={t.id}>{t.label} — {formatEUR(t.amount)}</option>)}
                  <option value="">+ Nouveau tarif</option>
                </Select>
              )}
              <div className="grid grid-cols-[1fr_120px] gap-3">
                <Input name="label" placeholder="Cotisation annuelle" defaultValue={type?.label ?? ""} key={`l-${typeId}`} required />
                <Input name="amount" placeholder="30,00 €" inputMode="decimal" defaultValue={type ? (type.amount / 100).toFixed(2).replace(".", ",") : ""} key={`a-${typeId}`} required className="text-right" />
              </div>
              <AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} onlyClasses={[7]} />
              <Button type="submit" size="sm" loading={pending} className="justify-self-end">{typeId ? "Mettre à jour le tarif" : "Créer le tarif"}</Button>
            </form>

            <form
              action={(fd) =>
                start(async () => {
                  fd.set("feeTypeId", typeId);
                  const r = await issueFees(orgId, fd);
                  if (!r.ok) return setError(r.error);
                  toast.success(`${r.data} cotisation(s) créée(s)`);
                  setOpen(false);
                  router.refresh();
                })
              }
              className="grid gap-3"
            >
              <Field label="Libellé de la période" htmlFor="f-label"><Input id="f-label" name="label" defaultValue={`Saison ${year}`} required /></Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Début"><Input name="periodStart" type="date" defaultValue={`${year}-01-01`} required /></Field>
                <Field label="Fin"><Input name="periodEnd" type="date" defaultValue={`${year}-12-31`} required /></Field>
                <Field label="Échéance"><Input name="dueDate" type="date" defaultValue={`${year}-03-31`} required /></Field>
              </div>
              {error && <p className="text-[13px] text-negative">{error}</p>}
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
                <Button type="submit" variant="primary" loading={pending} disabled={!typeId || !type?.amount}>Appeler les cotisations</Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
