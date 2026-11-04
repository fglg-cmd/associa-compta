import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, MapPin, Phone } from "lucide-react";
import { getOrgContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getBankAccounts } from "@/modules/accounting/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Amount } from "@/components/ui/misc";
import type { FeePayment, FeeType, Member, MemberFee } from "@/lib/types";
import { fmtDate, todayISO } from "@/lib/utils";
import { MemberDialog } from "../member-dialog";
import { FeeActions, NewFeeDialog } from "./fee-actions";

const METHOD = { cash: "Espèces", cheque: "Chèque", transfer: "Virement", card: "Carte", other: "Autre" };

export default async function MemberPage({ params }: { params: Promise<{ org: string; id: string }> }) {
  const { org: slug, id } = await params;
  const { org, canWrite } = await getOrgContext(slug);
  const supabase = await createClient();
  const { data: member } = await supabase.from("members").select("*").eq("id", id).eq("organization_id", org.id).maybeSingle<Member>();
  if (!member) notFound();
  const [{ data: feesData }, { data: types }, banks] = await Promise.all([
    supabase.from("member_fees").select("*, fee_payments(*), fee_reminders(sent_at, status)").eq("member_id", id).order("period_start", { ascending: false }),
    supabase.from("fee_types").select("*").eq("organization_id", org.id).eq("is_active", true),
    getBankAccounts(org.id),
  ]);
  const fees = (feesData ?? []) as (MemberFee & { fee_payments: FeePayment[]; fee_reminders: { sent_at: string; status: string }[] })[];
  const { data: pendingTx } = await supabase.from("bank_transactions").select("id, date, label, amount").eq("organization_id", org.id).eq("status", "pending").gt("amount", 0).order("date", { ascending: false }).limit(100);
  const today = todayISO();

  const history = [
    { date: member.joined_at, text: "Adhésion" },
    ...fees.flatMap((f) => [
      ...f.fee_payments.map((p) => ({ date: p.date, text: `Paiement ${METHOD[p.method]} de ${(p.amount / 100).toFixed(2).replace(".", ",")} € — ${f.label}` })),
      ...f.fee_reminders.map((r) => ({ date: r.sent_at.slice(0, 10), text: `Relance e-mail ${r.status === "sent" ? "envoyée" : "en échec"} — ${f.label}` })),
    ]),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <Link href={`/app/${slug}/adherents`} className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted hover:text-foreground"><ArrowLeft className="size-3.5" /> Adhérents</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted tabular">Adhérent n° {member.member_number} · depuis le {fmtDate(member.joined_at)}</p>
          <h1 className="mt-0.5 text-[22px] font-semibold tracking-[-0.02em]">{member.first_name} {member.last_name}</h1>
          <div className="mt-2 flex flex-wrap gap-4 text-[13px] text-muted">
            {member.email && <a href={`mailto:${member.email}`} className="inline-flex items-center gap-1.5 hover:text-foreground"><Mail className="size-3.5" /> {member.email}</a>}
            {member.phone && <span className="inline-flex items-center gap-1.5"><Phone className="size-3.5" /> {member.phone}</span>}
            {member.city && <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" /> {[member.address_line, member.postal_code, member.city].filter(Boolean).join(", ")}</span>}
          </div>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <MemberDialog orgId={org.id} member={member} />
            <NewFeeDialog orgId={org.id} memberId={member.id} feeTypes={(types ?? []) as FeeType[]} />
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader><CardTitle>Cotisations</CardTitle></CardHeader>
          {fees.length === 0 ? (
            <CardContent><p className="text-[13px] text-muted">Aucune cotisation pour cet adhérent.</p></CardContent>
          ) : (
            <ul className="divide-y divide-border border-t border-border">
              {fees.map((f) => {
                const late = (f.status === "due" || f.status === "partial") && f.due_date < today;
                return (
                  <li key={f.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-[13px]">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{f.label}</div>
                      <div className="text-xs text-muted">Échéance {fmtDate(f.due_date)}{f.fee_payments.length ? ` · ${f.fee_payments.length} paiement(s)` : ""}</div>
                    </div>
                    <Badge tone={f.status === "paid" ? "positive" : f.status === "cancelled" ? "neutral" : late ? "negative" : "warning"} dot>
                      {f.status === "paid" ? "Payée" : f.status === "cancelled" ? "Annulée" : f.status === "partial" ? "Partielle" : late ? "En retard" : "À régler"}
                    </Badge>
                    <span className="w-32 text-right tabular"><Amount cents={f.amount_paid} /> <span className="text-muted">/ <Amount cents={f.amount_due} /></span></span>
                    {canWrite && f.status !== "paid" && f.status !== "cancelled" && (
                      <FeeActions
                        orgId={org.id}
                        fee={{ id: f.id, label: f.label, remaining: f.amount_due - f.amount_paid }}
                        hasEmail={Boolean(member.email)}
                        bankAccounts={banks.filter((b) => !b.is_archived).map((b) => ({ id: b.id, name: b.name }))}
                        pendingTx={(pendingTx ?? []) as { id: string; date: string; label: string; amount: number }[]}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader><CardTitle>Historique</CardTitle></CardHeader>
          <CardContent>
            <ol className="relative grid gap-3 border-l border-border pl-4">
              {history.map((h, i) => (
                <li key={i} className="text-[13px]">
                  <span className="absolute -left-[4.5px] mt-1.5 size-2 rounded-full bg-border-strong" />
                  <div className="text-xs text-muted">{fmtDate(h.date)}</div>
                  <div>{h.text}</div>
                </li>
              ))}
            </ol>
            {member.notes && <p className="mt-4 rounded-md bg-surface-2 p-3 text-[13px] text-muted whitespace-pre-wrap">{member.notes}</p>}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
