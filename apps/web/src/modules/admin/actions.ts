"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isPlatformAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { run, unwrap } from "@/lib/action";
import { sendEmail } from "@/lib/email";
import { supportReplyEmail } from "@/lib/email-templates";

async function guard() {
  if (!(await isPlatformAdmin())) throw Object.assign(new Error("Accès réservé à l'équipe ASSOCIA COMPTA."), { code: "42501" });
  return createAdminClient();
}

export async function replyTicket(ticketId: string, form: FormData) {
  return run(async () => {
    const admin = await guard();
    const v = z.object({ reply: z.string().trim().min(2).max(10000), status: z.enum(["open", "pending", "resolved"]) }).parse(Object.fromEntries(form));
    const t = unwrap(await admin.from("support_tickets").update({ admin_reply: v.reply, status: v.status }).eq("id", ticketId).select("subject, profiles(email)").single());
    const email = (t as unknown as { profiles: { email: string } | null }).profiles?.email;
    if (email) await sendEmail({ to: email, ...supportReplyEmail({ subject: (t as { subject: string }).subject, reply: v.reply }) });
    revalidatePath("/admin/support");
  });
}

/** Geste commercial : attribution manuelle d'une offre (hors Stripe), tracée dans le journal d'audit. */
export async function setOrganizationPlan(orgId: string, plan: string) {
  return run(async () => {
    const admin = await guard();
    const p = z.enum(["free", "essential", "pro"]).parse(plan);
    unwrap(await admin.from("organizations").update({ plan: p }).eq("id", orgId));
    await admin.from("audit_log").insert({ organization_id: orgId, action: "update", entity: "plan_override", data: { plan: p } });
    revalidatePath("/admin/associations");
  });
}
