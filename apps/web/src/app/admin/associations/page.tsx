import { assertPlatformAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { fmtDate } from "@/lib/utils";
import { PlanSelect } from "./plan-select";

export default async function AdminOrgs({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await assertPlatformAdmin();
  const { q } = await searchParams;
  const admin = createAdminClient();
  let query = admin.from("organizations").select("id, name, slug, plan, city, created_at, memberships(count), members(count), journal_entries(count)").order("created_at", { ascending: false }).limit(200);
  if (q) query = query.ilike("name", `%${q.replace(/[%_]/g, "")}%`);
  const { data } = await query;
  const rows = (data ?? []) as unknown as { id: string; name: string; slug: string; plan: string; city: string | null; created_at: string; memberships: { count: number }[]; members: { count: number }[]; journal_entries: { count: number }[] }[];
  return (
    <>
      <PageHeader title="Clients" description={`${rows.length} association(s) affichée(s)`} actions={<form><input name="q" defaultValue={q} placeholder="Rechercher…" className="h-8 w-56 rounded-md border border-border bg-surface px-2.5 text-sm" /></form>} />
      <Card className="overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="border-b border-border text-left text-xs text-muted"><tr><th className="py-2 pl-5 font-medium">Association</th><th className="font-medium">Inscription</th><th className="text-right font-medium">Utilisateurs</th><th className="text-right font-medium">Adhérents</th><th className="text-right font-medium">Écritures</th><th className="pr-5 font-medium">Offre</th></tr></thead>
          <tbody className="divide-y divide-border">
            {rows.map((o) => (
              <tr key={o.id}>
                <td className="py-2.5 pl-5"><div className="font-medium">{o.name}</div><div className="text-xs text-muted">{o.slug}{o.city ? ` · ${o.city}` : ""}</div></td>
                <td className="text-muted">{fmtDate(o.created_at)}</td>
                <td className="text-right tabular">{o.memberships[0]?.count ?? 0}</td>
                <td className="text-right tabular">{o.members[0]?.count ?? 0}</td>
                <td className="text-right tabular">{o.journal_entries[0]?.count ?? 0}</td>
                <td className="pr-5"><PlanSelect orgId={o.id} plan={o.plan} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
