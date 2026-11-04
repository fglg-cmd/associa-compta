"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { saveMember } from "@/modules/members/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import type { Member } from "@/lib/types";
import { todayISO } from "@/lib/utils";

export function MemberDialog({ orgId, member, defaultOpen }: { orgId: string; member?: Member; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {member ? <Button size="sm"><Pencil /> Modifier</Button> : <Button variant="primary"><UserPlus /> Adhérent</Button>}
      </DialogTrigger>
      <DialogContent title={member ? "Modifier l'adhérent" : "Nouvel adhérent"}>
        <form
          action={(fd) =>
            start(async () => {
              const r = await saveMember(orgId, member?.id ?? null, fd);
              if (!r.ok) return setError(r.error);
              toast.success(member ? "Adhérent mis à jour" : "Adhérent ajouté");
              setOpen(false);
              if (!member) router.push(`adherents/${r.data}`);
              else router.refresh();
            })
          }
          className="grid gap-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom" htmlFor="m-first"><Input id="m-first" name="first_name" required defaultValue={member?.first_name} /></Field>
            <Field label="Nom" htmlFor="m-last"><Input id="m-last" name="last_name" required defaultValue={member?.last_name} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="E-mail" htmlFor="m-email" hint="Nécessaire pour les relances."><Input id="m-email" name="email" type="email" defaultValue={member?.email ?? ""} /></Field>
            <Field label="Téléphone" htmlFor="m-phone"><Input id="m-phone" name="phone" defaultValue={member?.phone ?? ""} /></Field>
          </div>
          <Field label="Adresse" htmlFor="m-addr"><Input id="m-addr" name="address_line" defaultValue={member?.address_line ?? ""} /></Field>
          <div className="grid grid-cols-[120px_1fr] gap-3">
            <Field label="Code postal" htmlFor="m-cp"><Input id="m-cp" name="postal_code" defaultValue={member?.postal_code ?? ""} /></Field>
            <Field label="Ville" htmlFor="m-city"><Input id="m-city" name="city" defaultValue={member?.city ?? ""} /></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Naissance" htmlFor="m-birth"><Input id="m-birth" name="birth_date" type="date" defaultValue={member?.birth_date ?? ""} /></Field>
            <Field label="Adhésion" htmlFor="m-join"><Input id="m-join" name="joined_at" type="date" required defaultValue={member?.joined_at ?? todayISO()} /></Field>
            <Field label="Statut">
              <Select name="status" defaultValue={member?.status ?? "active"}>
                <option value="active">Actif</option>
                <option value="pending">En attente</option>
                <option value="inactive">Inactif</option>
              </Select>
            </Field>
          </div>
          <Field label="Notes" htmlFor="m-notes"><Textarea id="m-notes" name="notes" defaultValue={member?.notes ?? ""} /></Field>
          {error && <p className="text-[13px] text-negative">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" variant="primary" loading={pending}>Enregistrer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
