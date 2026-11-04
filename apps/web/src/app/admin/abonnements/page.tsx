import { assertPlatformAdmin } from "@/lib/auth";
import { formatEUR } from "@associa/accounting";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/misc";
import { fmtDate } from "@/lib/utils";

export default async function AdminSubscriptions() {
  await assertPlatformAdmin();
  const admin = createAdminClient();
  const { data } = await admin.from("subscriptions").select("*, organizations(name)").order("updated_at", { ascending: false }).limit(500);
  const rows = (data ?? []) as unknown as { organization_id: string; plan: string; status: string; interval: string | null; amount: number | null; current_period_end: string | null; cancel_at_period_end: boolean; organizations: { name: string } }[];
  const active = rows.filter((r) => r.status === "active");
  const mrr = active.reduce((t, r) => t + (r.interval === "year" ? (r.amount ?? 0) / 12 : r.amount ?? 0), 0);
  const churnRisk = rows.filter((r) => r.cancel_at_period_end || r.status === "past_due").length;
  return (
    <>
      <PageHeader title="Abonnements et revenus" description="Synchronisés en temps réel depuis Stripe." />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><div className="text-[13px] text-muted">MRR</div><div className="mt-1 text-2xl font-semibold tabular">{formatEUR(Math.round(mrr))}</div></Card>
        <Card className="p-4"><div className="text-[13px] text-muted">Abonnements actifs</div><div className="mt-1 text-2xl font-semibold tabular">{active.length}</div></Card>
        <Card className="p-4"><div className="text-[13px] text-muted">À risque (résiliation, impayé)</div><div className="mt-1 text-2xl font-semibold tabular">{churnRisk}</div></Card>
      </div>
      <Card className="overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="border-b border-border text-left text-xs text-muted"><tr><th className="py-2 pl-5 font-medium">Association</th><th className="font-medium">Offre</th><th className="font-medium">Statut</th><th className="text-right font-medium">Montant</th><th className="pr-5 text-right font-medium">Échéance</th></tr></thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.organization_id}>
                <td className="py-2.5 pl-5 font-medium">{r.organizations?.name}</td>
                <td>{r.plan}</td>
                <td><Badge tone={r.status === "active" ? (r.cancel_at_period_end ? "warning" : "positive") : r.status === "past_due" ? "negative" : "neutral"}>{r.cancel_at_period_end ? "résilié en fin de période" : r.status}</Badge></td>
                <td className="text-right tabular">{r.amount ? `${formatEUR(r.amount)} / ${r.interval === "year" ? "an" : "mois"}` : "—"}</td>
                <td className="pr-5 text-right text-muted">{r.current_period_end ? fmtDate(r.current_period_end) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="p-8 text-center text-[13px] text-muted">Aucun abonnement pour l&apos;instant.</p>}
      </Card>
    </>
  );
}
