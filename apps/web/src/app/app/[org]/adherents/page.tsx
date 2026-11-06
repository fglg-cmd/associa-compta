import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { getOrgContext } from "@/lib/auth";
import { features } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/fetch-all";
import { getAccounts } from "@/modules/accounting/queries";
import { PageHeader, EmptyState, Amount } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { FeeType, Member, MemberFee } from "@/lib/types";
import { cn, fmtDate, initials, todayISO } from "@/lib/utils";
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
  // « À régler » regroupe les cotisations à échéance et en retard (badge distinct).
  const matches = (key: string) => (sp.paiement === "due" || sp.paiement === "late" ? key === "due" || key === "late" : key === sp.paiement);
  const filtered = sp.paiement ? members.filter((m) => matches(status(m.id).key)) : members;
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

  const counts = { all: members.length, paid: 0, due: 0, none: 0 };
  for (const m of members) {
    const k = status(m.id).key;
    if (k === "paid") counts.paid++;
    else if (k === "due" || k === "late") counts.due++;
    else counts.none++;
  }
  const ratio = members.length ? Math.round((upToDate / members.length) * 100) : 0;
  const FILTERS = [
    { k: "", l: "Tous", n: counts.all },
    { k: "paid", l: "À jour", n: counts.paid },
    { k: "due", l: "À régler", n: counts.due },
    { k: "none", l: "Sans cotisation", n: counts.none },
  ];
  const currentFilter = sp.paiement === "late" ? "due" : sp.paiement ?? "";

  return (
    <>
      <PageHeader
        title="Adhérents"
        description="Vos membres et leurs cotisations. Chaque paiement est comptabilisé automatiquement."
        actions={canWrite && (
          <>
            <ImportMembersDialog orgId={org.id} />
            <FeesToolbar orgId={org.id} feeTypes={(types ?? []) as FeeType[]} accounts={accounts.filter((a) => a.number.startsWith("7")).map((a) => ({ id: a.id, number: a.number, label: a.label, is_active: a.is_active }))} overdueCount={features.email ? overdueCount : 0} />
            <MemberDialog orgId={org.id} defaultOpen={sp.action === "ajouter"} />
          </>
        )}
      />

      {members.length > 0 && (
        <Card className="mb-6 grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="p-4">
            <div className="text-[13px] text-muted">Adhérents actifs</div>
            <div className="mt-1 text-[22px] font-semibold tracking-[-0.02em] tabular">{active}</div>
          </div>
          <div className="p-4">
            <div className="flex items-baseline justify-between text-[13px] text-muted"><span>À jour de cotisation</span><span className="text-xs tabular">{ratio} %</span></div>
            <div className="mt-1 text-[22px] font-semibold tracking-[-0.02em] tabular">{upToDate}<span className="text-[15px] font-normal text-muted"> sur {members.length}</span></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-positive" style={{ width: `${ratio}%` }} /></div>
          </div>
          <div className="p-4">
            <div className="text-[13px] text-muted">Reste à encaisser</div>
            <div className="mt-1 text-[22px] font-semibold tracking-[-0.02em]"><Amount cents={outstanding} /></div>
            {overdueCount > 0 && <div className="mt-0.5 text-xs font-medium text-negative">dont {overdueCount} en retard</div>}
          </div>
        </Card>
      )}

      {members.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="inline-flex flex-wrap rounded-lg border border-border bg-surface-2 p-0.5">
            {FILTERS.map(({ k, l, n }) => (
              <Link key={k} href={link({ paiement: k || undefined })} className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] font-medium", currentFilter === k ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground")}>
                {l}<span className="text-xs text-subtle tabular">{n}</span>
              </Link>
            ))}
          </div>
          <form action={base} className="ml-auto">
            <input name="q" defaultValue={sp.q} placeholder="Rechercher un adhérent…" className="h-8 w-56 rounded-md border border-border bg-surface px-2.5 text-sm shadow-xs focus:border-accent focus:outline-none" />
          </form>
        </div>
      )}

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={members.length ? "Aucun adhérent ne correspond" : "Ajoutez vos adhérents"}
            description={members.length ? "Essayez un autre filtre ou une autre recherche." : "Un par un avec « Ajouter un adhérent », ou d'un coup en important votre fichier Excel ou HelloAsso (CSV)."}
          />
        ) : (
          <table className="w-full text-[13.5px]">
            <thead className="border-b border-border text-left text-xs text-muted">
              <tr><th className="py-2.5 pl-5 font-medium">Adhérent</th><th className="font-medium">Cotisation</th><th className="pr-5 text-right font-medium">Reste dû</th><th className="w-8" /></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((m) => {
                const s = status(m.id);
                return (
                  <tr key={m.id} className="group relative transition-colors hover:bg-surface-2/50">
                    <td className="py-2.5 pl-5">
                      <Link href={`${base}/${m.id}`} className="flex items-center gap-3 after:absolute after:inset-0">
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-muted">{initials(`${m.first_name} ${m.last_name}`)}</span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{m.first_name} {m.last_name}{m.status !== "active" && <Badge className="ml-2">{m.status === "inactive" ? "Inactif" : "En attente"}</Badge>}</span>
                          <span className="block truncate text-xs text-muted">{m.email ?? m.phone ?? `Adhérent depuis le ${fmtDate(m.joined_at)}`}</span>
                        </span>
                      </Link>
                    </td>
                    <td><Badge tone={s.tone} dot>{s.label}</Badge></td>
                    <td className="pr-5 text-right font-medium tabular">{s.due ? <Amount cents={s.due} /> : <span className="text-subtle">—</span>}</td>
                    <td className="pr-4"><ChevronRight className="size-4 text-subtle transition-transform group-hover:translate-x-0.5" /></td>
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
