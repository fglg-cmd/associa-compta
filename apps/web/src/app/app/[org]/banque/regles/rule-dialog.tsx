"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteRule, saveRule, toggleRule } from "@/modules/bank/actions";
import { AccountSelect } from "@/components/finance/account-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { Field, Input, Select } from "@/components/ui/input";
import type { Account, CategorizationRule, Project } from "@/lib/types";

type Props = {
  orgId: string;
  accounts: Pick<Account, "id" | "number" | "label" | "is_active">[];
  exclude: string[];
  projects: Pick<Project, "id" | "name">[];
};

function RuleForm({ orgId, accounts, exclude, projects, rule, onDone }: Props & { rule?: CategorizationRule; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [accountId, setAccountId] = useState(rule?.account_id ?? "");
  const router = useRouter();
  return (
    <form
      action={(fd) =>
        start(async () => {
          fd.set("accountId", accountId);
          const r = await saveRule(orgId, rule?.id ?? null, fd);
          if (!r.ok) return setError(r.error);
          toast.success("Règle enregistrée");
          onDone();
          router.refresh();
        })
      }
      className="grid gap-3"
    >
      <Field label="Nom" htmlFor="r-name"><Input id="r-name" name="name" required defaultValue={rule?.name} placeholder="Assurance MAIF" /></Field>
      <div className="grid grid-cols-[1fr_1.4fr] gap-3">
        <Field label="Le libellé…">
          <Select name="matchType" defaultValue={rule?.match_type ?? "contains"}>
            <option value="contains">contient</option>
            <option value="starts_with">commence par</option>
            <option value="equals">est exactement</option>
            <option value="regex">expression régulière</option>
          </Select>
        </Field>
        <Field label="Texte" htmlFor="r-pattern"><Input id="r-pattern" name="pattern" required defaultValue={rule?.pattern} placeholder="maif" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Sens">
          <Select name="direction" defaultValue={rule?.direction ?? "any"}>
            <option value="any">Tous</option>
            <option value="in">Encaissements</option>
            <option value="out">Décaissements</option>
          </Select>
        </Field>
        <Field label="Priorité" hint="La plus petite s'applique d'abord."><Input name="priority" type="number" min={1} max={1000} defaultValue={rule?.priority ?? 100} /></Field>
      </div>
      <Field label="Catégorie"><AccountSelect accounts={accounts} exclude={exclude} value={accountId} onChange={setAccountId} required /></Field>
      {projects.length > 0 && (
        <Field label="Projet (facultatif)">
          <Select name="projectId" defaultValue={rule?.project_id ?? ""}>
            <option value="">Aucun</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
      )}
      {error && <p className="text-[13px] text-negative">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>Annuler</Button>
        <Button type="submit" variant="primary" loading={pending}>Enregistrer</Button>
      </DialogFooter>
    </form>
  );
}

export function RuleDialog(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="primary"><Plus /> Nouvelle règle</Button></DialogTrigger>
      <DialogContent title="Nouvelle règle"><RuleForm {...props} onDone={() => setOpen(false)} /></DialogContent>
    </Dialog>
  );
}

export function RuleRowActions(props: Props & { rule: CategorizationRule }) {
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const router = useRouter();
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error);
      router.refresh();
    });
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button size="icon-sm" variant="ghost" aria-label="Actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => setOpen(true)}><Pencil /> Modifier</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => act(() => toggleRule(props.orgId, props.rule.id, !props.rule.is_active))}><Power /> {props.rule.is_active ? "Désactiver" : "Activer"}</DropdownMenuItem>
          <DropdownMenuItem destructive onSelect={() => act(() => deleteRule(props.orgId, props.rule.id))}><Trash2 /> Supprimer</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Modifier la règle"><RuleForm {...props} onDone={() => setOpen(false)} /></DialogContent>
      </Dialog>
    </>
  );
}
