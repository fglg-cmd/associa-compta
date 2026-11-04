"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseAmount } from "@associa/accounting";
import { detectDelimiter, parseDate, splitCsv, decodeBankFile } from "@associa/bank-import";
import { requireOrgWriter } from "@/lib/auth";
import { run, unwrap } from "@/lib/action";
import { planOf } from "@/lib/plans";
import { sendEmail } from "@/lib/email";
import { feeReminderEmail } from "@/lib/email-templates";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");
const opt = (s: z.ZodType<string>) => z.union([z.literal(""), s]).optional().transform((v) => v || null);

const memberSchema = z.object({
  first_name: z.string().trim().min(1, "Prénom requis.").max(80),
  last_name: z.string().trim().min(1, "Nom requis.").max(80),
  email: opt(z.email("E-mail invalide.")),
  phone: opt(z.string().trim().max(30)),
  address_line: opt(z.string().trim().max(200)),
  postal_code: opt(z.string().trim().max(10)),
  city: opt(z.string().trim().max(80)),
  birth_date: opt(isoDate),
  status: z.enum(["active", "inactive", "pending"]).default("active"),
  joined_at: isoDate,
  notes: opt(z.string().trim().max(2000)),
});

async function assertMemberQuota(orgId: string, adding: number) {
  const { supabase, org } = await requireOrgWriter(orgId);
  const { count } = await supabase.from("members").select("*", { count: "exact", head: true }).eq("organization_id", orgId);
  const limit = planOf(org.plan).limits.members;
  if ((count ?? 0) + adding > limit) throw new Error(`Votre offre est limitée à ${limit} adhérents. Passez à l'offre supérieure.`);
}

export async function saveMember(orgId: string, memberId: string | null, form: FormData) {
  return run(async () => {
    const { supabase, org } = await requireOrgWriter(orgId);
    const v = memberSchema.parse(Object.fromEntries(form));
    if (memberId) {
      unwrap(await supabase.from("members").update(v).eq("id", memberId).eq("organization_id", orgId));
    } else {
      await assertMemberQuota(orgId, 1);
      const m = unwrap(await supabase.from("members").insert({ ...v, organization_id: orgId }).select("id").single<{ id: string }>());
      memberId = m!.id;
    }
    revalidatePath(`/app/${org.slug}/adherents`, "layout");
    return memberId;
  });
}

export async function deleteMember(orgId: string, memberId: string) {
  return run(async () => {
    const { supabase, org } = await requireOrgWriter(orgId);
    const { count } = await supabase.from("fee_payments").select("id, member_fees!inner(member_id)", { count: "exact", head: true }).eq("member_fees.member_id", memberId);
    if (count) throw new Error("Cet adhérent a des paiements enregistrés : passez-le plutôt en « inactif » pour conserver l'historique comptable.");
    unwrap(await supabase.from("members").delete().eq("id", memberId).eq("organization_id", orgId));
    revalidatePath(`/app/${org.slug}/adherents`, "layout");
  });
}

/** Import d'une liste d'adhérents (CSV / export Excel en CSV). */
export async function importMembers(orgId: string, form: FormData) {
  return run(async () => {
    const { supabase, org } = await requireOrgWriter(orgId);
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Aucun fichier.");
    if (file.size > 2 * 1024 * 1024) throw new Error("Fichier trop volumineux (2 Mo maximum).");
    const text = decodeBankFile(new Uint8Array(await file.arrayBuffer()));
    const rows = splitCsv(text, detectDelimiter(text));
    if (rows.length < 2) throw new Error("Le fichier doit contenir une ligne d'en-tête et au moins un adhérent.");
    const h = rows[0]!.map((c) => c.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim());
    const col = (...re: RegExp[]) => h.findIndex((c) => re.some((r) => r.test(c)));
    const idx = {
      first: col(/^prenom/, /first/),
      last: col(/^nom$/, /^nom de famille/, /last/, /^nom\b/),
      email: col(/mail/),
      phone: col(/tel/, /phone|mobile|portable/),
      address: col(/adresse/, /address/),
      cp: col(/code postal|^cp$/, /zip|postal/),
      city: col(/^ville/, /city|commune/),
      birth: col(/naissance/, /birth/),
      joined: col(/adhesion|inscription/, /joined/),
    };
    if (idx.first < 0 || idx.last < 0) throw new Error("Colonnes « Prénom » et « Nom » introuvables dans l'en-tête.");
    const records = rows.slice(1).map((r) => {
      const g = (i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
      const email = g(idx.email).toLowerCase();
      return {
        organization_id: orgId,
        first_name: g(idx.first).slice(0, 80),
        last_name: g(idx.last).slice(0, 80),
        email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null,
        phone: g(idx.phone).slice(0, 30) || null,
        address_line: g(idx.address).slice(0, 200) || null,
        postal_code: g(idx.cp).slice(0, 10) || null,
        city: g(idx.city).slice(0, 80) || null,
        birth_date: parseDate(g(idx.birth)) ?? null,
        joined_at: parseDate(g(idx.joined)) ?? new Date().toISOString().slice(0, 10),
      };
    }).filter((r) => r.first_name && r.last_name);
    await assertMemberQuota(orgId, records.length);
    // Dédoublonnage sur l'e-mail (déjà présents ou répétés dans le fichier)
    const { data: existing } = await supabase.from("members").select("email").eq("organization_id", orgId).not("email", "is", null);
    const known = new Set((existing ?? []).map((e) => (e.email as string).toLowerCase()));
    const fresh = records.filter((r) => !r.email || (!known.has(r.email) && (known.add(r.email), true)));
    for (let i = 0; i < fresh.length; i += 200) unwrap(await supabase.from("members").insert(fresh.slice(i, i + 200)));
    revalidatePath(`/app/${org.slug}/adherents`, "layout");
    return { imported: fresh.length, skipped: records.length - fresh.length + (rows.length - 1 - records.length) };
  });
}

export async function saveFeeType(orgId: string, feeTypeId: string | null, form: FormData) {
  return run(async () => {
    const { supabase, org } = await requireOrgWriter(orgId);
    const v = z.object({ label: z.string().trim().min(2).max(80), amount: z.string(), accountId: z.uuid() }).parse(Object.fromEntries(form));
    const amount = parseAmount(v.amount);
    if (amount === null || amount < 0) throw new Error("Montant invalide.");
    const row = { label: v.label, amount, account_id: v.accountId };
    if (feeTypeId) unwrap(await supabase.from("fee_types").update(row).eq("id", feeTypeId).eq("organization_id", orgId));
    else unwrap(await supabase.from("fee_types").insert({ ...row, organization_id: orgId }));
    revalidatePath(`/app/${org.slug}/adherents`, "layout");
  });
}

const issueSchema = z.object({ feeTypeId: z.uuid(), label: z.string().trim().min(1).max(80), periodStart: isoDate, periodEnd: isoDate, dueDate: isoDate });

/** Appel de cotisation pour tous les adhérents actifs. */
export async function issueFees(orgId: string, form: FormData) {
  return run(async () => {
    const { supabase, org } = await requireOrgWriter(orgId);
    const v = issueSchema.parse(Object.fromEntries(form));
    const n = unwrap(await supabase.rpc("issue_fees", { p_org: orgId, p_fee_type: v.feeTypeId, p_label: v.label, p_period_start: v.periodStart, p_period_end: v.periodEnd, p_due_date: v.dueDate })) as number;
    revalidatePath(`/app/${org.slug}/adherents`, "layout");
    return n;
  });
}

export async function createFee(orgId: string, memberId: string, form: FormData) {
  return run(async () => {
    const { supabase, org } = await requireOrgWriter(orgId);
    const v = z.object({ label: z.string().trim().min(1).max(80), amount: z.string(), periodStart: isoDate, periodEnd: isoDate, dueDate: isoDate, feeTypeId: z.union([z.literal(""), z.uuid()]).optional() }).parse(Object.fromEntries(form));
    const amount = parseAmount(v.amount);
    if (!amount || amount <= 0) throw new Error("Montant invalide.");
    unwrap(await supabase.from("member_fees").insert({ organization_id: orgId, member_id: memberId, fee_type_id: v.feeTypeId || null, label: v.label, period_start: v.periodStart, period_end: v.periodEnd, amount_due: amount, due_date: v.dueDate }));
    revalidatePath(`/app/${org.slug}/adherents`, "layout");
  });
}

export async function recordPayment(orgId: string, feeId: string, form: FormData) {
  return run(async () => {
    const { supabase, org } = await requireOrgWriter(orgId);
    const v = z
      .object({ date: isoDate, amount: z.string(), method: z.enum(["cash", "cheque", "transfer", "card", "other"]), bankAccountId: z.union([z.literal(""), z.uuid()]).optional(), bankTxId: z.union([z.literal(""), z.uuid()]).optional() })
      .parse(Object.fromEntries(form));
    const amount = parseAmount(v.amount);
    if (!amount || amount <= 0) throw new Error("Montant invalide.");
    unwrap(await supabase.rpc("record_fee_payment", { p_fee: feeId, p_date: v.date, p_amount: amount, p_method: v.method, p_bank_account: v.bankAccountId || null, p_bank_tx: v.bankTxId || null }));
    revalidatePath(`/app/${org.slug}`, "layout");
  });
}

export async function cancelFee(orgId: string, feeId: string) {
  return run(async () => {
    const { supabase, org } = await requireOrgWriter(orgId);
    const { data: f } = await supabase.from("member_fees").select("amount_paid").eq("id", feeId).eq("organization_id", orgId).single<{ amount_paid: number }>();
    if (!f) throw new Error("Cotisation introuvable.");
    if (f.amount_paid === 0) unwrap(await supabase.from("member_fees").delete().eq("id", feeId));
    else unwrap(await supabase.from("member_fees").update({ status: "cancelled" }).eq("id", feeId));
    revalidatePath(`/app/${org.slug}/adherents`, "layout");
  });
}

/** Relance par e-mail (une cotisation ou toutes les cotisations échues). */
export async function sendReminders(orgId: string, feeIds: string[] | "overdue") {
  return run(async () => {
    const { supabase, user, org } = await requireOrgWriter(orgId);
    if (planOf(org.plan).tier === "free" && (feeIds === "overdue" || feeIds.length > 1)) {
      throw new Error("Les relances groupées sont incluses dans l'offre Essentiel.");
    }
    const { data: orgRow } = await supabase.from("organizations").select("name, email").eq("id", orgId).single<{ name: string; email: string | null }>();
    let q = supabase.from("member_fees").select("id, label, amount_due, amount_paid, due_date, members(first_name, last_name, email)").eq("organization_id", orgId).in("status", ["due", "partial"]);
    q = feeIds === "overdue" ? q.lt("due_date", new Date().toISOString().slice(0, 10)) : q.in("id", feeIds);
    const { data: fees } = await q.limit(500);
    // Anti-spam : pas plus d'une relance par cotisation tous les 7 jours
    const since = new Date(Date.now() - 7 * 864e5).toISOString();
    const { data: recent } = await supabase.from("fee_reminders").select("member_fee_id").eq("organization_id", orgId).eq("status", "sent").gte("sent_at", since);
    const recentSet = new Set((recent ?? []).map((r) => r.member_fee_id as string));
    let sent = 0, skipped = 0, failed = 0;
    let lastError = "";
    for (const f of (fees ?? []) as unknown as { id: string; label: string; amount_due: number; amount_paid: number; due_date: string; members: { first_name: string; last_name: string; email: string | null } }[]) {
      if (!f.members.email || recentSet.has(f.id)) { skipped++; continue; }
      const mail = feeReminderEmail({ orgName: orgRow!.name, firstName: f.members.first_name, label: f.label, remaining: f.amount_due - f.amount_paid, dueDate: f.due_date, contactEmail: orgRow!.email });
      const r = await sendEmail({ to: f.members.email, ...mail });
      await supabase.from("fee_reminders").insert({ organization_id: orgId, member_fee_id: f.id, status: r.ok ? "sent" : "failed", provider_id: r.ok ? r.id : null, error: r.ok ? null : r.error, sent_by: user.id });
      if (r.ok) sent++;
      else { failed++; lastError = r.error; }
    }
    if (failed && !sent) throw new Error(lastError || "Échec de l'envoi.");
    revalidatePath(`/app/${org.slug}/adherents`, "layout");
    return { sent, skipped, failed };
  });
}
