import Link from "next/link";
import { ArrowLeft, Wand2 } from "lucide-react";
import { getOrgContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAccounts, getBankAccounts } from "@/modules/accounting/queries";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { CategorizationRule, Project } from "@/lib/types";
import { RuleDialog, RuleRowActions } from "./rule-dialog";

export const metadata = { title: "Règles de catégorisation" };

const MATCH = { contains: "contient", starts_with: "commence par", equals: "est exactement", regex: "correspond à l'expression" };
const DIR = { any: "", in: " · encaissements", out: " · décaissements" };

export default async function RulesPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: slug } = await params;
  const { org, canWrite } = await getOrgContext(slug);
  const supabase = await createClient();
  const [{ data }, accounts, banks, { data: projects }] = await Promise.all([
    supabase.from("categorization_rules").select("*").eq("organization_id", org.id).order("priority").order("created_at"),
    getAccounts(org.id),
    getBankAccounts(org.id),
    supabase.from("projects").select("id, name").eq("organization_id", org.id).order("name"),
  ]);
  const rules = (data ?? []) as CategorizationRule[];
  const label = new Map(accounts.map((a) => [a.id, `${a.number} · ${a.label}`]));
  const acc = accounts.map((a) => ({ id: a.id, number: a.number, label: a.label, is_active: a.is_active }));
  const exclude = banks.map((b) => b.account_id);
  const proj = (projects ?? []) as Pick<Project, "id" | "name">[];

  return (
    <>
      <Link href={`/app/${slug}/banque`} className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted hover:text-foreground"><ArrowLeft className="size-3.5" /> Banque</Link>
      <PageHeader
        title="Règles de catégorisation"
        description="Appliquées à chaque import, par ordre de priorité. Elles s'enrichissent automatiquement quand vous validez des mouvements."
        actions={canWrite && <RuleDialog orgId={org.id} accounts={acc} exclude={exclude} projects={proj} />}
      />
      <Card className="overflow-hidden">
        {rules.length === 0 ? (
          <EmptyState icon={Wand2} title="Aucune règle pour l'instant" description="Validez quelques mouvements avec « Mémoriser mes choix » : les règles se créent toutes seules." />
        ) : (
          <div className="divide-y divide-border">
            {rules.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-[13px]">
                <span className="w-8 text-xs text-subtle tabular">{r.priority}</span>
                <div className="min-w-0 flex-1">
                  <div className={r.is_active ? "font-medium" : "font-medium text-muted line-through"}>
                    Le libellé {MATCH[r.match_type]} <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">{r.pattern}</code>{DIR[r.direction]}
                  </div>
                  <div className="text-xs text-muted">→ {label.get(r.account_id) ?? "compte supprimé"}{r.project_id && proj.find((p) => p.id === r.project_id) ? ` · ${proj.find((p) => p.id === r.project_id)!.name}` : ""}</div>
                </div>
                <span className="text-xs text-muted tabular">{r.hits} utilisation(s)</span>
                {canWrite && <RuleRowActions orgId={org.id} rule={r} accounts={acc} exclude={exclude} projects={proj} />}
              </div>
            ))}
          </div>
        )}
      </Card>
      {!canWrite && <Button asChild className="mt-4"><Link href={`/app/${slug}/banque`}>Retour</Link></Button>}
    </>
  );
}
