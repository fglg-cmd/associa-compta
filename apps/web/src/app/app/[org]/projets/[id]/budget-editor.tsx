"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatEUR } from "@associa/accounting";
import { deleteBudgetLine, deleteProject, saveBudgetLine } from "@/modules/projects/actions";
import { AccountSelect } from "@/components/finance/account-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import type { Account, ProjectBudgetLine } from "@/lib/types";
import { cn } from "@/lib/utils";

export function BudgetEditor({ orgId, projectId, canWrite, lines, rows, accounts }: { orgId: string; projectId: string; canWrite: boolean; lines: ProjectBudgetLine[]; rows: { label: string; direction: "income" | "expense"; budget: number; actual: number }[]; accounts: Pick<Account, "id" | "number" | "label" | "is_active">[] }) {
  const [pending, start] = useTransition();
  const [accountId, setAccountId] = useState("");
  const router = useRouter();
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) { toast.error(r.error); return; }
      router.refresh();
    });

  return (
    <Card>
      <CardHeader><CardTitle>Budget prévu et réalisé</CardTitle></CardHeader>
      <div className="border-t border-border">
        <table className="w-full text-[13px] tabular">
          <thead className="text-left text-xs text-muted"><tr><th className="py-2 pl-5 font-medium">Poste</th><th className="text-right font-medium">Budget</th><th className="text-right font-medium">Réalisé</th><th className="pr-5 text-right font-medium">Écart</th><th className="w-8" /></tr></thead>
          <tbody className="divide-y divide-border">
            {rows.map((r, i) => {
              const line = lines[i];
              const gap = r.direction === "income" ? r.actual - r.budget : r.budget - r.actual;
              return (
                <tr key={i}>
                  <td className="py-2 pl-5"><span className={cn("mr-1.5 inline-block size-1.5 rounded-full", r.direction === "income" ? "bg-chart-1" : "bg-chart-2")} />{r.label}</td>
                  <td className="text-right">{r.budget ? formatEUR(r.budget) : "—"}</td>
                  <td className="text-right">{formatEUR(r.actual)}</td>
                  <td className={cn("pr-5 text-right", r.budget && gap < 0 && "text-negative")}>{r.budget ? formatEUR(gap, { signed: true }) : ""}</td>
                  <td className="pr-2">{canWrite && line && <Button size="icon-sm" variant="ghost" aria-label="Supprimer" onClick={() => act(() => deleteBudgetLine(orgId, line.id))}><Trash2 /></Button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {canWrite && (
        <CardContent className="border-t border-border pt-4">
          <form
            action={(fd) => { fd.set("accountId", accountId); act(async () => { const r = await saveBudgetLine(orgId, projectId, null, fd); if (r.ok) setAccountId(""); return r; }); }}
            className="grid gap-2 sm:grid-cols-[110px_1fr_110px_auto]"
          >
            <Select name="direction" defaultValue="expense"><option value="expense">Dépense</option><option value="income">Recette</option></Select>
            <Input name="label" placeholder="Location de salle" required />
            <Input name="amount" placeholder="0,00 €" inputMode="decimal" required className="text-right" />
            <Button type="submit" loading={pending}><Plus /> Ajouter</Button>
            <div className="sm:col-span-4"><AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} placeholder="Compte suivi (facultatif, pour comparer au réalisé)" className="h-7 text-xs" /></div>
          </form>
        </CardContent>
      )}
    </Card>
  );
}

export function DeleteProjectButton({ orgId, projectId, slug }: { orgId: string; projectId: string; slug: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant="ghost"
      className="text-negative"
      loading={pending}
      onClick={() => {
        if (!confirm("Supprimer ce projet ? Les opérations restent en comptabilité, sans imputation.")) return;
        start(async () => {
          const r = await deleteProject(orgId, projectId);
          if (!r.ok) { toast.error(r.error); return; }
          router.push(`/app/${slug}/projets`);
        });
      }}
    >
      <Trash2 /> Supprimer
    </Button>
  );
}
