"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Plus } from "lucide-react";
import { toast } from "sonner";
import { closeFiscalYear, createAccount, openNextFiscalYear, toggleAccount } from "@/modules/accounting/actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const CLASSES: Record<string, string> = { "1": "Fonds propres, fonds dédiés, emprunts", "2": "Immobilisations", "3": "Stocks", "4": "Tiers", "5": "Financiers", "6": "Charges", "7": "Produits", "8": "Contributions volontaires en nature" };

export function AccountsManager({ orgId, canWrite, accounts }: { orgId: string; canWrite: boolean; accounts: { id: string; number: string; label: string; is_active: boolean; is_system: boolean }[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const groups = Object.entries(CLASSES).map(([c, l]) => ({ c, l, list: accounts.filter((a) => a.number.startsWith(c)) }));
  return (
    <div className="grid gap-4">
      {canWrite && (
        <Card className="p-4">
          <form
            action={(fd) => start(async () => { const r = await createAccount(orgId, fd); if (!r.ok) return setError(r.error); setError(null); toast.success("Compte créé"); router.refresh(); })}
            className="flex flex-wrap items-end gap-2"
          >
            <Input name="number" placeholder="6257" required className="w-28 font-mono" />
            <Input name="label" placeholder="Réceptions et cérémonies" required className="min-w-56 flex-1" />
            <Button type="submit" loading={pending}><Plus /> Ajouter un compte</Button>
            {error && <p className="w-full text-[13px] text-negative">{error}</p>}
          </form>
        </Card>
      )}
      {groups.map((g) => g.list.length > 0 && (
        <Card key={g.c} className="overflow-hidden">
          <div className="border-b border-border bg-surface-2/60 px-5 py-2 text-xs font-semibold text-muted">Classe {g.c} — {g.l}</div>
          <ul className="divide-y divide-border">
            {g.list.map((a) => (
              <li key={a.id} className={cn("flex items-center gap-3 px-5 py-2 text-[13px]", !a.is_active && "text-muted")}>
                <span className="w-16 font-mono text-xs">{a.number}</span>
                <span className="flex-1">{a.label}</span>
                {canWrite && !a.is_system && (
                  <button className="text-xs text-muted hover:text-foreground" onClick={() => start(async () => { const r = await toggleAccount(orgId, a.id, !a.is_active); if (!r.ok) toast.error(r.error); router.refresh(); })}>{a.is_active ? "Désactiver" : "Réactiver"}</button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

export function FiscalYearActions({ orgId, fyId, label, drafts = 0, pending = 0, openNext }: { orgId: string; fyId?: string; label?: string; drafts?: number; pending?: number; openNext?: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, start] = useTransition();
  const router = useRouter();
  if (openNext) {
    return (
      <Button size="sm" variant="ghost" loading={busy} onClick={() => start(async () => { const r = await openNextFiscalYear(orgId); if (!r.ok) { toast.error(r.error); return; } toast.success("Exercice suivant ouvert"); router.refresh(); })}>
        <Plus /> Ouvrir l&apos;exercice suivant
      </Button>
    );
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Lock /> Clôturer</Button></DialogTrigger>
      <DialogContent title={`Clôturer l'${label?.toLowerCase()}`} description="La clôture est définitive : plus aucune écriture ne pourra être ajoutée, modifiée ou contre-passée sur cet exercice.">
        <ul className="grid gap-2 text-[13px]">
          <li className={cn(drafts ? "text-negative" : "text-positive")}>{drafts ? `${drafts} écriture(s) en brouillon à valider ou supprimer` : "Aucune écriture en brouillon"}</li>
          <li className={cn(pending ? "text-warning" : "text-positive")}>{pending ? `${pending} mouvement(s) bancaire(s) non comptabilisé(s) sur la période` : "Tous les mouvements bancaires sont comptabilisés"}</li>
        </ul>
        <p className="mt-3 text-[13px] text-muted">Pensez à générer et archiver le compte de résultat, le bilan et le FEC avant de clôturer.</p>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button variant="danger" disabled={drafts > 0} loading={busy} onClick={() => start(async () => { const r = await closeFiscalYear(orgId, fyId!); if (!r.ok) { toast.error(r.error); return; } toast.success("Exercice clôturé"); setOpen(false); router.refresh(); })}>
            Clôturer définitivement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
