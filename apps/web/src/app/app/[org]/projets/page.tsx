import Link from "next/link";
import { CalendarDays, ChevronRight, FolderKanban } from "lucide-react";
import { getOrgContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState, Amount } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import type { Project } from "@/lib/types";
import { cn, fmtDate } from "@/lib/utils";
import { ProjectDialog } from "./project-dialog";

export const metadata = { title: "Projets" };

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
        title="Projets"
        description="Un budget par événement ou projet, et ce qu'il rapporte vraiment."
        actions={canWrite && <ProjectDialog orgId={org.id} defaultOpen={sp.action === "creer"} />}
      />
      <div className="mb-4 inline-flex rounded-lg border border-border bg-surface-2 p-0.5">
        <Link href={`/app/${slug}/projets`} className={cn("rounded-md px-2.5 py-1 text-[13px] font-medium", !showClosed ? "bg-surface shadow-sm" : "text-muted hover:text-foreground")}>En cours</Link>
        <Link href={`/app/${slug}/projets?vue=clotures`} className={cn("rounded-md px-2.5 py-1 text-[13px] font-medium", showClosed ? "bg-surface shadow-sm" : "text-muted hover:text-foreground")}>Terminés</Link>
      </div>
      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={FolderKanban}
            title={showClosed ? "Aucun projet terminé" : "Suivez vos événements"}
            description={showClosed ? undefined : "Kermesse, tournoi, séjour… Créez-le, puis choisissez-le quand vous validez une recette ou une dépense : vous saurez ce qu'il a rapporté."}
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => {
            const f = finBy.get(p.id) ?? { bi: 0, be: 0, ai: 0, ae: 0 };
            const result = f.ai - f.ae;
            const spent = f.be ? Math.min(100, Math.round((f.ae / f.be) * 100)) : 0;
            return (
              <Link key={p.id} href={`/app/${slug}/projets/${p.id}`} className="group">
                <Card className="flex h-full flex-col p-5 transition-[border-color,box-shadow] group-hover:border-border-strong group-hover:shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{p.name}</span>
                    <ChevronRight className="size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 pl-5 text-xs text-muted">
                    {p.kind === "event" ? "Événement" : "Projet"}
                    {p.start_date && <><span aria-hidden>·</span><CalendarDays className="size-3" />{fmtDate(p.start_date)}{p.end_date && p.end_date !== p.start_date ? ` → ${fmtDate(p.end_date)}` : ""}</>}
                  </p>
                  <div className="mt-5 flex items-end justify-between gap-3">
                    <div>
                      <div className="text-xs text-muted">Résultat</div>
                      <div className={cn("text-[22px] font-semibold tracking-[-0.02em] tabular", result < 0 && "text-negative", result > 0 && "text-positive")}><Amount cents={result} signed /></div>
                    </div>
                    <div className="text-right text-xs text-muted tabular">
                      <div><Amount cents={f.ai} /> de recettes</div>
                      <div><Amount cents={f.ae} /> de dépenses</div>
                    </div>
                  </div>
                  {f.be > 0 && (
                    <div className="mt-4">
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2"><div className={cn("h-full rounded-full", spent >= 100 ? "bg-negative" : "bg-chart-1")} style={{ width: `${spent}%` }} /></div>
                      <p className="mt-1.5 text-xs text-muted">{spent} % du budget de dépenses utilisé</p>
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
