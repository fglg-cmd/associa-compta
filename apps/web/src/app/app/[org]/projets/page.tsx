import Link from "next/link";
import { CalendarDays, FolderKanban } from "lucide-react";
import { getOrgContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState, Amount } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Project } from "@/lib/types";
import { cn, fmtDate } from "@/lib/utils";
import { ProjectDialog } from "./project-dialog";

export const metadata = { title: "Projets et événements" };

type Fin = { project_id: string; budget_income: number; budget_expense: number; actual_income: number; actual_expense: number };

export default async function ProjectsPage({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<{ action?: string; vue?: string }> }) {
  const { org: slug } = await params;
  const sp = await searchParams;
  const { org, canWrite } = await getOrgContext(slug);
  const supabase = await createClient();
  const [{ data: projects }, { data: fin }] = await Promise.all([
    supabase.from("projects").select("*").eq("organization_id", org.id).order("status").order("start_date", { ascending: false, nullsFirst: false }),
    supabase.rpc("project_financials", { p_org: org.id }),
  ]);
  const finBy = new Map(((fin ?? []) as Fin[]).map((f) => [f.project_id, { bi: Number(f.budget_income), be: Number(f.budget_expense), ai: Number(f.actual_income), ae: Number(f.actual_expense) }]));
  const showClosed = sp.vue === "clotures";
  const list = ((projects ?? []) as Project[]).filter((p) => (showClosed ? p.status === "closed" : p.status !== "closed"));

  return (
    <>
      <PageHeader
        title="Projets et événements"
        description="Un budget par projet, le réalisé en temps réel, la rentabilité de chaque événement."
        actions={canWrite && <ProjectDialog orgId={org.id} defaultOpen={sp.action === "creer"} />}
      />
      <div className="mb-4 inline-flex rounded-lg border border-border bg-surface-2 p-0.5">
        <Link href={`/app/${slug}/projets`} className={cn("rounded-md px-2.5 py-1 text-[13px] font-medium", !showClosed ? "bg-surface shadow-sm" : "text-muted")}>En cours</Link>
        <Link href={`/app/${slug}/projets?vue=clotures`} className={cn("rounded-md px-2.5 py-1 text-[13px] font-medium", showClosed ? "bg-surface shadow-sm" : "text-muted")}>Clôturés</Link>
      </div>
      {list.length === 0 ? (
        <Card><EmptyState icon={FolderKanban} title="Aucun projet" description="Créez un projet ou un événement (kermesse, tournoi, séjour…), puis rattachez-y vos recettes et dépenses lors de la catégorisation." /></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => {
            const f = finBy.get(p.id) ?? { bi: 0, be: 0, ai: 0, ae: 0 };
            const result = f.ai - f.ae;
            const budgetResult = f.bi - f.be;
            const spent = f.be ? Math.min(100, Math.round((f.ae / f.be) * 100)) : 0;
            return (
              <Link key={p.id} href={`/app/${slug}/projets/${p.id}`}>
                <Card className="h-full p-4 transition-shadow hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ background: p.color }} />
                      <span className="font-medium">{p.name}</span>
                    </div>
                    <Badge tone={p.kind === "event" ? "accent" : "neutral"}>{p.kind === "event" ? "Événement" : "Projet"}</Badge>
                  </div>
                  {(p.start_date || p.end_date) && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted"><CalendarDays className="size-3" />{p.start_date ? fmtDate(p.start_date) : "…"}{p.end_date && p.end_date !== p.start_date ? ` → ${fmtDate(p.end_date)}` : ""}</p>
                  )}
                  <dl className="mt-4 grid grid-cols-2 gap-y-1 text-[13px]">
                    <dt className="text-muted">Recettes</dt><dd className="text-right tabular"><Amount cents={f.ai} />{f.bi ? <span className="text-xs text-muted"> / <Amount cents={f.bi} /></span> : null}</dd>
                    <dt className="text-muted">Dépenses</dt><dd className="text-right tabular"><Amount cents={f.ae} />{f.be ? <span className="text-xs text-muted"> / <Amount cents={f.be} /></span> : null}</dd>
                    <dt className="font-medium">Résultat</dt><dd className={cn("text-right font-semibold tabular", result < 0 && "text-negative", result > 0 && "text-positive")}><Amount cents={result} signed /></dd>
                  </dl>
                  {f.be > 0 && (
                    <div className="mt-3">
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2"><div className={cn("h-full rounded-full", spent >= 100 ? "bg-negative" : "bg-chart-1")} style={{ width: `${spent}%` }} /></div>
                      <p className="mt-1 text-xs text-muted">{spent} % du budget de dépenses consommé · prévu <Amount cents={budgetResult} signed /></p>
                    </div>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
