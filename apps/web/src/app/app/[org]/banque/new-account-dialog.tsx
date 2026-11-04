"use client";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createBankAccount } from "@/modules/bank/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { todayISO } from "@/lib/utils";

export function NewBankAccountDialog({ orgId, variant = "primary" }: { orgId: string; variant?: "primary" | "secondary" }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant}><Plus /> Compte bancaire</Button>
      </DialogTrigger>
      <DialogContent title="Nouveau compte bancaire" description="Un compte 512 et un journal de banque dédiés sont créés automatiquement.">
        <form
          action={(fd) =>
            start(async () => {
              const r = await createBankAccount(orgId, fd);
              if (!r.ok) return setError(r.error);
              toast.success("Compte bancaire créé");
              setOpen(false);
            })
          }
          className="grid gap-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nom" htmlFor="ba-name"><Input id="ba-name" name="name" required defaultValue="Compte courant" /></Field>
            <Field label="Banque" htmlFor="ba-bank"><Input id="ba-bank" name="bankName" placeholder="La Banque Postale" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Solde d'ouverture" htmlFor="ba-open" hint="Solde du relevé à la date ci-contre."><Input id="ba-open" name="openingBalance" inputMode="decimal" placeholder="0,00" /></Field>
            <Field label="À la date du" htmlFor="ba-date"><Input id="ba-date" name="openingDate" type="date" required defaultValue={todayISO()} /></Field>
          </div>
          <Field label="4 derniers caractères de l'IBAN" htmlFor="ba-iban" hint="Facultatif, pour distinguer vos comptes."><Input id="ba-iban" name="ibanLast4" maxLength={4} className="w-28 uppercase" /></Field>
          {error && <p className="text-[13px] text-negative">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" variant="primary" loading={pending}>Créer le compte</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
