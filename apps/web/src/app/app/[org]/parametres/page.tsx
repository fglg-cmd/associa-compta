import Link from "next/link";
import { getOrgContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { features } from "@/lib/env";
import { PLANS, planFeatures, planOf } from "@/lib/plans";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, fmtDate } from "@/lib/utils";
import { BillingPanel, DangerZone, InviteForm, MemberRow, OrgForm, RevokeInvite, SupportForm } from "./client";

export const metadata = { title: "Paramètres" };

const ROLE_LABEL = { owner: "Propriétaire", admin: "Administrateur", treasurer: "Trésorier", member: "Membre du bureau", viewer: "Lecteur" };

export default async function SettingsPage({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<{ onglet?: string; statut?: string; raison?: string }> }) {
  const { org: slug } = await params;
  const sp = await searchParams;
  const ctx = await getOrgContext(slug);
  const { org, canAdmin, role, userId } = ctx;
  // « danger » (ancien onglet) : la suppression est désormais en bas de l'onglet Association.
  const tab = ["association", "equipe", "abonnement", "support"].includes(sp.onglet ?? "") ? sp.onglet! : "association";
  const supabase = await createClient();
  const link = (t: string) => `/app/${slug}/parametres?onglet=${t}`;

  let content: React.ReactNode = null;
  if (tab === "association") {
    content = (
      <div className="grid gap-6">
        <Card><CardHeader><div><CardTitle>Votre association</CardTitle><CardDescription>Ces informations figurent sur vos rapports et vos e-mails aux adhérents.</CardDescription></div></CardHeader>
          <CardContent><OrgForm orgId={org.id} org={org} disabled={!canAdmin} /></CardContent></Card>
        {role === "owner" && (
          <details id="suppression" open={sp.onglet === "danger"} className="group rounded-xl border border-border bg-surface shadow-xs [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-[13.5px] font-medium text-muted hover:text-foreground">
              Supprimer l&apos;association
              <span className="text-xs transition-transform group-open:rotate-90">›</span>
            </summary>
            <div className="border-t border-border px-5 py-4">
              <p className="mb-4 text-[13px] text-muted">Toutes les données (écritures, justificatifs, adhérents) sont définitivement effacées. Téléchargez d&apos;abord vos comptes et votre FEC depuis Rapports.</p>
              <DangerZone orgId={org.id} orgName={org.name} isOwner />
            </div>
          </details>
        )}
      </div>
    );
  }
  if (tab === "equipe") {
    const [{ data: members }, { data: invites }] = await Promise.all([
      supabase.from("memberships").select("user_id, role, created_at, profiles(email, full_name)").eq("organization_id", org.id).order("created_at"),
      canAdmin ? supabase.from("invitations").select("id, email, role, expires_at").eq("organization_id", org.id).is("accepted_at", null) : Promise.resolve({ data: [] }),
    ]);
    content = (
      <div className="grid gap-4">
        <Card>
          <CardHeader><div><CardTitle>Équipe</CardTitle><CardDescription>Les membres du bureau qui ont accès à la comptabilité · {planOf(org.plan).limits.seats} accès inclus.</CardDescription></div></CardHeader>
          <ul className="divide-y divide-border border-t border-border">
            {((members ?? []) as unknown as { user_id: string; role: keyof typeof ROLE_LABEL; profiles: { email: string; full_name: string | null } | null }[]).map((m) => (
              <MemberRow key={m.user_id} orgId={org.id} userId={m.user_id} name={m.profiles?.full_name ?? m.profiles?.email ?? "—"} email={m.profiles?.email ?? ""} role={m.role} canEdit={canAdmin && m.user_id !== userId && (role === "owner" || m.role !== "owner")} isSelf={m.user_id === userId} />
            ))}
          </ul>
          {canAdmin && (
            <CardContent className="border-t border-border pt-4">
              <p className="mb-2 text-[13px] font-medium">Inviter quelqu&apos;un</p>
              <InviteForm orgId={org.id} emailEnabled={features.email} />
              <p className="mt-2 text-xs text-muted">Le rôle « Lecteur » permet de tout consulter sans rien modifier : idéal pour un vérificateur aux comptes.</p>
              {(invites ?? []).length > 0 && (
                <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
                  {((invites ?? []) as { id: string; email: string; role: keyof typeof ROLE_LABEL; expires_at: string }[]).map((i) => (
                    <li key={i.id} className="flex items-center gap-3 px-3 py-2 text-[13px]"><span className="flex-1">{i.email}</span><Badge>{ROLE_LABEL[i.role]}</Badge><span className="text-xs text-muted">expire le {fmtDate(i.expires_at)}</span><RevokeInvite orgId={org.id} id={i.id} /></li>
                  ))}
                </ul>
              )}
            </CardContent>
          )}
        </Card>
      </div>
    );
  }
  if (tab === "abonnement") {
    const { data: sub } = await supabase.from("subscriptions").select("*").eq("organization_id", org.id).maybeSingle();
    content = features.beta ? (
      <Card><CardHeader><div><CardTitle>Phase de lancement : tout est gratuit</CardTitle><CardDescription>Pendant la phase de lancement, votre association bénéficie gratuitement de toutes les fonctionnalités, sans limite. Vous serez prévenu au moins un mois à l&apos;avance avant toute mise en place d&apos;un abonnement, et vous pourrez à tout moment exporter vos données.</CardDescription></div></CardHeader></Card>
    ) : <>{sp.raison === "export" && <div className="mb-4 rounded-lg bg-accent-soft px-4 py-3 text-[13px] text-accent">Les exports Excel et PDF détaillés (balance, grand livre, journal) sont inclus dès l&apos;offre Essentiel.</div>}<BillingPanel orgId={org.id} current={org.plan} plans={Object.values(PLANS).map((p) => ({ ...p, features: planFeatures(p, features.ai) }))} subscription={sub} canManage={canAdmin} billingEnabled={features.billing} success={sp.statut === "succes"} /></>;
  }
  if (tab === "support") {
    const { data: tickets } = await supabase.from("support_tickets").select("id, subject, status, admin_reply, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
    content = (
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><div><CardTitle>Une question ?</CardTitle><CardDescription>Écrivez-nous : une vraie personne vous répond sous 24 h ouvrées.</CardDescription></div></CardHeader><CardContent><SupportForm orgId={org.id} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Vos demandes</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            {(tickets ?? []).length === 0 && <p className="text-[13px] text-muted">Aucune demande.</p>}
            {((tickets ?? []) as { id: string; subject: string; status: string; admin_reply: string | null; created_at: string }[]).map((t) => (
              <div key={t.id} className="rounded-lg border border-border p-3 text-[13px]">
                <div className="flex items-center justify-between gap-2"><span className="font-medium">{t.subject}</span><Badge tone={t.status === "resolved" ? "positive" : "warning"}>{t.status === "resolved" ? "Résolue" : t.status === "pending" ? "En cours" : "Ouverte"}</Badge></div>
                <div className="text-xs text-muted">{fmtDate(t.created_at)}</div>
                {t.admin_reply && <p className="mt-2 whitespace-pre-wrap rounded-md bg-surface-2 p-2 text-[13px]">{t.admin_reply}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Paramètres">
        <div className="flex flex-wrap gap-1 border-b border-border">
          {[["association", "Association"], ["equipe", "Équipe"], ["abonnement", "Abonnement"], ["support", "Aide"]].map(([k, l]) => (
            <Link key={k} href={link(k!)} className={cn("-mb-px border-b-2 px-3 py-2 text-[13px] font-medium", tab === k ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground")}>{l}</Link>
          ))}
        </div>
      </PageHeader>
      <div className="max-w-4xl">{content}</div>
    </>
  );
}
