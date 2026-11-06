import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getOrgContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAccounts } from "@/modules/accounting/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Amount } from "@/components/ui/misc";
import type { Project, ProjectBudgetLine } from "@/lib/types";
import { cn, fmtDate, fmtDateShort } from "@/lib/utils";
import { ProjectDialog } from "../project-dialog";
import { BudgetEditor, DeleteProjectButton } from "./budget-editor";

export default async function ProjectPage({ params }: { params: Promise<{ org: string; id: string }> }) {
  const { org: slug, id } = await params;
  const { org, canWrite } = await getOrgContext(slug);
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("*").eq("id", id).eq("organization_id", org.id).maybeSingle<Project>();
  if (!project) notFound();
  const [{ data: budget }, { data: lines }, accounts] = await Promise.all([
    supabase.from("project_budget_lines").select("*").eq("project_id", id).order("direction").order("created_at"),
    supabase.from("v_ledger_lines").select("entry_id, date, label, account_id, account_number, account_label, debit, credit").eq("project_id", id).eq("status", "posted").order("date", { ascending: false }),
    getAccounts(org.id),
  ]);
  const budgetLines = (budget ?? []) as ProjectBudgetLine[];
  const actual = ((lines ?? []) as { entry_id: string; date: string; label: string; account_id: string; account_number: string; account_label: string; debit: number; credit: number }[]).filter((l) => /^[67]/.test(l.account_number));

  // Réalisé par compte, rapproché des lignes budgétaires de même compte
  const byAccount = new Map<string, { label: string; number: string; amount: number }>();
  for (const l of actual) {
    const amt = l.account_number.startsWith("7") ? Number(l.credit) - Number(l.debit) : Number(l.debit) - Number(l.credit);
    const cur = byAccount.get(l.account_id) ?? { label: l.account_label, number: l.account_number, amount: 0 };
    cur.amount += amt;
    byAccount.set(l.account_id, cur);
  }
  const rows: { label: string; direction: "income" | "expense"; budget: number; actual: number }[] = [];
  const used = new Set<string>();
  for (const b of budgetLines) {
    const a = b.account_id ? byAccount.get(b.account_id) : undefined;
    if (b.account_id && a && !used.has(b.account_id)) used.add(b.account_id);
    rows.push({ label: b.label, direction: b.direction, budget: b.amount, actual: b.account_id && a ? a.amount : 0 });
  }
  for (const [accId, a] of byAccount) if (!used.has(accId)) rows.push({ label: a.label, direction: a.number.startsWith("7") ? "income" : "expense", budget: 0, actual: a.amount });

  const sum = (dir: "income" | "expense", k: "budget" | "actual") => rows.filter((r) => r.direction === dir).reduce((t, r) => t + r[k], 0);
  const bi = sum("income", "budget"), be = sum("expense", "budget"), ai = sum("income", "actual"), ae = sum("expense", "actual");

  return (
    <>
      <Link href={`/app/${slug}/projets`} className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted hover:text-foreground"><ArrowLeft className="size-3.5" /> Projets</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><span className="size-3 rounded-full" style={{ background: project.color }} /><h1 className="text-[24px] font-semibold tracking-[-0.025em]">{project.name}</h1></div>
          <p className="mt-1 text-[13px] text-muted">{project.kind === "event" ? "Événement" : "Projet"}{project.start_date ? ` · ${fmtDate(project.start_date)}` : ""}{project.end_date && project.end_date !== project.start_date ? ` → ${fmtDate(project.end_date)}` : ""}</p>
          {project.description && <p className="mt-2 max-w-2xl text-[13px] text-muted">{project.description}</p>}
        </div>
        {canWrite && <div className="flex gap-2"><ProjectDialog orgId={org.id} project={project} /><DeleteProjectButton orgId={org.id} projectId={project.id} slug={slug} /></div>}
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          { l: "Recettes", a: ai, b: bi },
          { l: "Dépenses", a: ae, b: be },
          { l: "Résultat", a: ai - ae, b: bi - be },
        ].map((k) => (
          <Card key={k.l} className="p-4">
            <div className="text-[13px] text-muted">{k.l}</div>
            <div className={cn("mt-1 text-xl font-semibold tabular", k.l === "Résultat" && k.a < 0 && "text-negative")}><Amount cents={k.a} signed={k.l === "Résultat"} /></div>
            <div className="text-xs text-muted">{k.b ? <>Prévu : <Amount cents={k.b} signed={k.l === "Résultat"} /></> : "Aucun budget prévu"}</div>
          </Card>
        ))}
      </div>

      <div>
        <BudgetEditor
          orgId={org.id}
          projectId={project.id}
          canWrite={canWrite}
          lines={budgetLines}
          rows={rows}
          accounts={accounts.filter((a) => /^[67]/.test(a.number)).map((a) => ({ id: a.id, number: a.number, label: a.label, is_active: a.is_active }))}
        />
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Recettes et dépenses du projet</CardTitle></CardHeader>
        {actual.length ? (
          <ul className="divide-y divide-border border-t border-border">
            {actual.map((l, i) => (
              <li key={i} className="flex items-center gap-4 px-5 py-2.5 text-[13px]">
                <span className="w-14 text-xs text-muted tabular">{fmtDateShort(l.date)}</span>
                <span className="min-w-0 flex-1 truncate">{l.label}</span>
                <span className="hidden text-xs text-muted sm:block">{l.account_label}</span>
                <Amount cents={l.account_number.startsWith("7") ? Number(l.credit) - Number(l.debit) : -(Number(l.debit) - Number(l.credit))} signed colored className="w-24 text-right font-medium" />
              </li>
            ))}
          </ul>
        ) : (
          <CardContent><p className="text-[13px] text-muted">Aucune opération. Choisissez ce projet lors de la catégorisation de vos mouvements bancaires.</p></CardContent>
        )}
      </Card>
    </>
  );
}
