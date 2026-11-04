import { assertPlatformAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/misc";
import { fmtDate } from "@/lib/utils";
import { ReplyForm } from "./reply-form";

export default async function AdminSupport({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  await assertPlatformAdmin();
  const { statut } = await searchParams;
  const admin = createAdminClient();
  let q = admin.from("support_tickets").select("id, subject, message, status, admin_reply, created_at, profiles(email, full_name), organizations(name)").order("created_at", { ascending: false }).limit(100);
  if (statut) q = q.eq("status", statut);
  else q = q.neq("status", "resolved");
  const { data } = await q;
  const tickets = (data ?? []) as unknown as { id: string; subject: string; message: string; status: string; admin_reply: string | null; created_at: string; profiles: { email: string; full_name: string | null } | null; organizations: { name: string } | null }[];
  return (
    <>
      <PageHeader title="Support" description={statut ? `Demandes « ${statut} »` : "Demandes ouvertes et en cours"} actions={<a href={statut ? "/admin/support" : "/admin/support?statut=resolved"} className="text-[13px] text-muted hover:text-foreground">{statut ? "Voir les ouvertes" : "Voir les résolues"}</a>} />
      <div className="grid gap-3">
        {tickets.length === 0 && <Card className="p-8 text-center text-[13px] text-muted">Aucune demande.</Card>}
        {tickets.map((t) => (
          <Card key={t.id} className="p-4">
            <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{t.subject}</span><Badge tone={t.status === "resolved" ? "positive" : "warning"}>{t.status}</Badge><span className="ml-auto text-xs text-muted">{fmtDate(t.created_at)}</span></div>
            <div className="text-xs text-muted">{t.profiles?.full_name ?? t.profiles?.email} · {t.profiles?.email}{t.organizations ? ` · ${t.organizations.name}` : ""}</div>
            <p className="mt-2 whitespace-pre-wrap text-[13px]">{t.message}</p>
            <ReplyForm ticketId={t.id} defaultReply={t.admin_reply ?? ""} status={t.status} />
          </Card>
        ))}
      </div>
    </>
  );
}
