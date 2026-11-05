import Link from "next/link";
import { Users } from "lucide-react";
import { getOrgContext } from "@/lib/auth";
import { features } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/fetch-all";
import { getAccounts } from "@/modules/accounting/queries";
import { PageHeader, EmptyState, Amount } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { FeeType, Member, MemberFee } from "@/lib/types";
import { cn, fmtDate, todayISO } from "@/lib/utils";
import { MemberDialog } from "./member-dialog";
import { FeesToolbar, ImportMembersDialog } from "./toolbar";

export const metadata = { title: "Adhérents" };

export default async function MembersPage({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<{ q?: string; statut?: string; paiement?: string; action?: string }> }) {
  const { org: slug } = await params;
  const sp = await searchParams;
  const { org, canWrite } = await getOrgContext(slug);
  const supabase = await createClient();

  // Requête reconstruite à chaque page (les filtres Supabase modifient l'objet en place)
  const membersQuery = () => {
    let q = supabase.from("members").select("*").eq("organization_id", org.id);
    if (sp.statut) q = q.eq("status", sp.statut);
    const term = sp.q?.replace(/[%_,().*\\]/g, "").trim();
    if (term) q = q.or(`last_name.ilike.%${term}%,first_name.ilike.%${term}%,email.ilike.%${term}%`);
    return q;
  };
  const [{ data: membersData }, { data: feesData }, { data: types }, accounts] = await Promise.all([
    fetchAll((a, b) => membersQuery().order("last_name").order("first_name").order("id").range(a, b), 100_000).then((data) => ({ data })),
    fetchAll((a, b) => supabase.from("member_fees").select("id, member_id, label, amount_due, amount_paid, status, due_date").eq("organization_id", org.id).neq("status", "cancelled").order("id").range(a, b), 200_000).then((data) => ({ data })),
    supabase.from("fee_types").select("*").eq("organization_id", org.id).eq("is_active", true).order("label"),
    getAccounts(org.id),
  ]);
  const members = (membersData ?? []) as Member[];
  const fees = (feesData ?? []) as MemberFee[];
  const today = todayISO();
  const byMember = new Map<string, MemberFee[]>();
  for (const f of fees) byMember.set(f.member_id, [...(byMember.get(f.member_id) ?? []), f]);

  const status = (id: string) => {
    const list = byMember.get(id) ?? [];
    const open = list.filter((f) => f.status === "due" || f.status === "partial");
    if (!list.length) return { key: "none", label: "Aucune cotisation", tone: "neutral" as const, due: 0 };
    if (!open.length) return { key: "paid", label: "À jour", tone: "positive" as const, due: 0 };
    const due = open.reduce((t, f) => t + f.amount_due - f.amount_paid, 0);
    const late = open.some((f) => f.due_date < today);
    return { key: late ? "late" : "due", label: late ? "En retard" : "À régler", tone: late ? ("negative" as const) : ("warning" as const), due };
  };
  const filtered = sp.paiement ? members.filter((m) => status(m.id).key === sp.paiement) : members;
  const active = members.filter((m) => m.status === "active").length;
  const upToDate = members.filter((m) => status(m.id).key === "paid").length;
  const outstanding = fees.filter((f) => f.status === "due" || f.status === "partial").reduce((t, f) => t + f.amount_due - f.amount_paid, 0);
  const overdueCount = fees.filter((f) => (f.status === "due" || f.status === "partial") && f.due_date < today).length;
  const base = `/app/${slug}/adherents`;
  const link = (p: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: sp.q, statut: sp.statut, paiement: sp.paiement, ...p })) if (v) u.set(k, v);
    return `${base}?${u}`;
  };

  return (
    <>
      <PageHeader
        title="Adhérents"
        description="Membres, cotisations et relances. Chaque paiement enregistré passe automatiquement en comptabilité."
        actions={canWrite && (
          <>
            <ImportMembersDialog orgId={org.id} />
            <FeesToolbar orgId={org.id} feeTypes={(types ?? []) as FeeType[]} accounts={accounts.filter((a) => a.number.startsWith("7")).map((a) => ({ id: a.id, number: a.number, label: a.label, is_active: a.is_active }))} overdueCount={features.email ? overdueCount : 0} />
            <MemberDialog orgId={org.id} defaultOpen={sp.action === "ajouter"} />
          </>
        )}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><div className="text-[13px] text-muted">Adhérents actifs</div><div className="mt-1 text-xl font-semibold tabular">{active}</div></Card>
        <Card className="p-4"><div className="text-[13px] text-muted">À jour de cotisation</div><div className="mt-1 text-xl font-semibold tabular">{upToDate}<span className="text-sm font-normal text-muted"> / {members.length}</span></div></Card>
        <Card className="p-4"><div className="text-[13px] text-muted">Reste à encaisser</div><div className="mt-1 text-xl font-semibold"><Amount cents={outstanding} /></div>{overdueCount > 0 && <div className="text-xs text-negative">{overdueCount} cotisation(s) en retard</div>}</Card>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5">
          {[["", "Tous"], ["paid", "À jour"], ["due", "À régler"], ["late", "En retard"], ["none", "Sans cotisation"]].map(([k, l]) => (
            <Link key={k} href={link({ paiement: k || undefined })} className={cn("rounded-md px-2.5 py-1 text-[13px] font-medium", (sp.paiement ?? "") === k ? "bg-surface shadow-sm" : "text-muted hover:text-foreground")}>{l}</Link>
          ))}
        </div>
        <form action={base} className="ml-auto">
          <input name="q" defaultValue={sp.q} placeholder="Nom, prénom, e-mail…" className="h-8 w-56 rounded-md border border-border bg-surface px-2.5 text-sm shadow-xs focus:border-accent focus:outline-none" />
        </form>
      </div>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={Users} title={members.length ? "Aucun adhérent ne correspond" : "Aucun adhérent"} description={members.length ? undefined : "Ajoutez vos adhérents un par un ou importez votre fichier existant (CSV)."} />
        ) : (
          <table className="w-full text-[13px]">
            <thead className="border-b border-border text-left text-xs text-muted">
              <tr><th className="py-2 pl-5 font-medium">N°</th><th className="font-medium">Nom</th><th className="hidden font-medium md:table-cell">Contact</th><th className="hidden font-medium sm:table-cell">Adhésion</th><th className="font-medium">Cotisation</th><th className="pr-5 text-right font-medium">Reste dû</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((m) => {
                const s = status(m.id);
                return (
                  <tr key={m.id} className="hover:bg-surface-2/60">
                    <td className="py-2.5 pl-5 text-xs text-muted tabular">{m.member_number}</td>
                    <td><Link href={`${base}/${m.id}`} className="font-medium hover:text-accent">{m.last_name.toUpperCase()} {m.first_name}</Link>{m.status !== "active" && <Badge className="ml-2">{m.status === "inactive" ? "Inactif" : "En attente"}</Badge>}</td>
                    <td className="hidden text-muted md:table-cell">{m.email ?? m.phone ?? "—"}</td>
                    <td className="hidden text-muted sm:table-cell">{fmtDate(m.joined_at)}</td>
                    <td><Badge tone={s.tone} dot>{s.label}</Badge></td>
                    <td className="pr-5 text-right tabular">{s.due ? <Amount cents={s.due} /> : <span className="text-subtle">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
