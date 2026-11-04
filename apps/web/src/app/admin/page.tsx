import { formatEUR } from "@associa/accounting";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { fmtDateShort } from "@/lib/utils";

type Stats = { organizations: number; organizations_30d: number; users: number; users_30d: number; paying: number; mrr: number; by_plan: Record<string, number>; entries: number; documents: number; ai_messages_30d: number; signups_by_week: { week: string; count: number }[] };

export default async function AdminHome() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_platform_stats");
  if (error) throw error;
  const s = data as Stats;
  const kpis = [
    { l: "MRR", v: formatEUR(Number(s.mrr)), h: `ARR ${formatEUR(Number(s.mrr) * 12)}` },
    { l: "Clients payants", v: String(s.paying), h: s.organizations ? `${((s.paying / s.organizations) * 100).toFixed(1)} % de conversion` : "" },
    { l: "Associations", v: String(s.organizations), h: `+${s.organizations_30d} sur 30 jours` },
    { l: "Utilisateurs", v: String(s.users), h: `+${s.users_30d} sur 30 jours` },
  ];
  const max = Math.max(1, ...s.signups_by_week.map((w) => w.count));
  return (
    <>
      <PageHeader title="Vue d'ensemble" description="Indicateurs SaaS en temps réel." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => <Card key={k.l} className="p-4"><div className="text-[13px] text-muted">{k.l}</div><div className="mt-1 text-2xl font-semibold tabular">{k.v}</div><div className="text-xs text-muted">{k.h}</div></Card>)}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Nouvelles associations par semaine</CardTitle></CardHeader>
          <CardContent>
            {s.signups_by_week.length === 0 ? <p className="text-[13px] text-muted">Aucune inscription sur 12 semaines.</p> : (
              <div className="grid gap-1.5">
                {s.signups_by_week.map((w) => (
                  <div key={w.week} className="flex items-center gap-3 text-xs"><span className="w-14 text-muted tabular">{fmtDateShort(w.week)}</span><div className="h-3 flex-1 rounded-sm bg-surface-2"><div className="h-full rounded-sm bg-chart-1" style={{ width: `${(w.count / max) * 100}%` }} /></div><span className="w-6 text-right tabular">{w.count}</span></div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Usage</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-[13px]">
            {Object.entries(s.by_plan).map(([p, n]) => <div key={p} className="flex justify-between"><span className="text-muted">Offre {p}</span><span className="tabular">{n}</span></div>)}
            <div className="flex justify-between border-t border-border pt-2"><span className="text-muted">Écritures comptables</span><span className="tabular">{s.entries}</span></div>
            <div className="flex justify-between"><span className="text-muted">Documents stockés</span><span className="tabular">{s.documents}</span></div>
            <div className="flex justify-between"><span className="text-muted">Questions à l&apos;IA (30 j)</span><span className="tabular">{s.ai_messages_30d}</span></div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
