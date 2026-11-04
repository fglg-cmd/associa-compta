import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { feeReminderEmail } from "@/lib/email-templates";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Relances automatiques quotidiennes (offres payantes) :
 * cotisation échue depuis ≥ 7 jours, au plus 3 relances, espacées de 14 jours.
 * Déclenché par Vercel Cron (Authorization: Bearer CRON_SECRET).
 */
export async function GET(req: NextRequest) {
  if (!serverEnv.cronSecret || req.headers.get("authorization") !== `Bearer ${serverEnv.cronSecret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const admin = createAdminClient();
  const today = new Date();
  const overdueBefore = new Date(today.getTime() - 7 * 864e5).toISOString().slice(0, 10);
  const lastAllowed = new Date(today.getTime() - 14 * 864e5).toISOString();

  const { data: orgs } = await admin.from("organizations").select("id, name, email").neq("plan", "free");
  let sent = 0;
  let failed = 0;
  for (const org of (orgs ?? []) as { id: string; name: string; email: string | null }[]) {
    const { data: fees } = await admin
      .from("member_fees")
      .select("id, label, amount_due, amount_paid, due_date, members!inner(first_name, email, status), fee_reminders(sent_at, status)")
      .eq("organization_id", org.id)
      .in("status", ["due", "partial"])
      .lte("due_date", overdueBefore)
      .eq("members.status", "active")
      .not("members.email", "is", null)
      .limit(500);
    for (const f of (fees ?? []) as unknown as { id: string; label: string; amount_due: number; amount_paid: number; due_date: string; members: { first_name: string; email: string }; fee_reminders: { sent_at: string; status: string }[] }[]) {
      const done = f.fee_reminders.filter((r) => r.status === "sent");
      if (done.length >= 3 || done.some((r) => r.sent_at > lastAllowed)) continue;
      const mail = feeReminderEmail({ orgName: org.name, firstName: f.members.first_name, label: f.label, remaining: f.amount_due - f.amount_paid, dueDate: f.due_date, contactEmail: org.email });
      const r = await sendEmail({ to: f.members.email, ...mail });
      await admin.from("fee_reminders").insert({ organization_id: org.id, member_fee_id: f.id, status: r.ok ? "sent" : "failed", provider_id: r.ok ? r.id : null, error: r.ok ? null : r.error });
      if (r.ok) sent++;
      else failed++;
    }
  }
  return NextResponse.json({ sent, failed });
}
