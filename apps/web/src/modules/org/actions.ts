"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ASSOCIATION_CHART, parseAmount } from "@associa/accounting";
import { createClient } from "@/lib/supabase/server";
import { requireOrgAdmin, requireUser } from "@/lib/auth";
import { fail, humanizeError, run, unwrap, type ActionResult } from "@/lib/action";
import { slugify } from "@/lib/utils";
import { sendEmail } from "@/lib/email";
import { invitationEmail } from "@/lib/email-templates";
import { publicEnv } from "@/lib/public-env";
import { planOf } from "@/lib/plans";
import { track } from "@/lib/analytics";

const onboardingSchema = z
  .object({
    name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères.").max(160),
    fyStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de début invalide."),
    fyEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de fin invalide."),
    bankName: z.string().trim().max(80).optional(),
    bankLabel: z.string().trim().max(80).optional(),
    openingBalance: z.string().optional(),
  })
  .refine((v) => v.fyEnd > v.fyStart, { message: "La fin d'exercice doit suivre son début.", path: ["fyEnd"] });

export async function createOrganization(_: unknown, form: FormData): Promise<ActionResult<never>> {
  await requireUser();
  let slug: string;
  try {
    const input = onboardingSchema.parse(Object.fromEntries(form));
    const supabase = await createClient();
    const base = slugify(input.name) || "association";
    slug = base.length < 3 ? `${base}-asso` : base;
    // Slug unique : suffixe aléatoire si collision
    for (let i = 0; i < 5; i++) {
      const candidate = i === 0 ? slug : `${slug.slice(0, 40)}-${Math.random().toString(36).slice(2, 6)}`;
      const { data, error } = await supabase.rpc("create_organization", {
        p_name: input.name,
        p_slug: candidate,
        p_fy_start: input.fyStart,
        p_fy_end: input.fyEnd,
        p_chart: ASSOCIATION_CHART,
      });
      if (!error) {
        slug = candidate;
        const orgId = data as string;
        const opening = parseAmount(input.openingBalance ?? "") ?? 0;
        await supabase
          .rpc("create_bank_account", {
            p_org: orgId,
            p_name: input.bankLabel || "Compte courant",
            p_bank_name: input.bankName ?? "",
            p_iban_last4: "",
            p_opening_balance: opening,
            p_opening_date: input.fyStart,
          })
          .then(unwrap);
        await track("organization_created", orgId, { opening_balance: opening !== 0 });
        break;
      }
      if (error.code !== "23505") throw error;
      if (i === 4) throw error;
    }
  } catch (e) {
    return fail(humanizeError(e));
  }
  redirect(`/app/${slug!}?bienvenue=1`);
}

const orgSchema = z.object({
  name: z.string().trim().min(2).max(160),
  siren: z.string().trim().regex(/^(\d{9})?$/, "Le SIREN comporte 9 chiffres.").optional(),
  rna: z.string().trim().toUpperCase().regex(/^(W[0-9A-Z]{9})?$/, "Le numéro RNA a la forme W123456789.").optional(),
  address_line: z.string().trim().max(200).optional(),
  postal_code: z.string().trim().max(10).optional(),
  city: z.string().trim().max(80).optional(),
  email: z.union([z.literal(""), z.email("E-mail invalide.")]).optional(),
});

export async function updateOrganization(orgId: string, form: FormData) {
  return run(async () => {
    const { supabase } = await requireOrgAdmin(orgId);
    const v = orgSchema.parse(Object.fromEntries(form));
    unwrap(
      await supabase
        .from("organizations")
        .update({
          name: v.name,
          siren: v.siren || null,
          rna: v.rna || null,
          address_line: v.address_line || null,
          postal_code: v.postal_code || null,
          city: v.city || null,
          email: v.email || null,
        })
        .eq("id", orgId),
    );
    revalidatePath("/app", "layout");
  });
}

const inviteSchema = z.object({
  email: z.email("E-mail invalide."),
  role: z.enum(["admin", "treasurer", "member", "viewer"]),
});

export async function inviteMember(orgId: string, form: FormData) {
  return run(async () => {
    const { supabase, user, org } = await requireOrgAdmin(orgId);
    const v = inviteSchema.parse(Object.fromEntries(form));
    const [{ count: members }, { count: pending }] = await Promise.all([
      supabase.from("memberships").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("invitations").select("*", { count: "exact", head: true }).eq("organization_id", orgId).is("accepted_at", null),
    ]);
    const seats = planOf(org.plan).limits.seats;
    if ((members ?? 0) + (pending ?? 0) >= seats) {
      throw new Error(`Votre offre inclut ${seats} accès. Passez à l'offre supérieure pour inviter davantage de personnes.`);
    }
    const inv = unwrap(
      await supabase
        .from("invitations")
        .insert({ organization_id: orgId, email: v.email.toLowerCase(), role: v.role, invited_by: user.id })
        .select("token")
        .single<{ token: string }>(),
    );
    const url = `${publicEnv.appUrl}/invitation/${inv!.token}`;
    const sent = await sendEmail({
      to: v.email,
      ...invitationEmail({ orgName: org.name, inviter: user.email ?? "", role: v.role, url }),
    });
    revalidatePath(`/app/${org.slug}/parametres`);
    return { url, emailed: sent.ok };
  });
}

export async function revokeInvitation(orgId: string, id: string) {
  return run(async () => {
    const { supabase, org } = await requireOrgAdmin(orgId);
    unwrap(await supabase.from("invitations").delete().eq("id", id).eq("organization_id", orgId));
    revalidatePath(`/app/${org.slug}/parametres`);
  });
}

export async function updateMemberRole(orgId: string, userId: string, role: string) {
  return run(async () => {
    const { supabase, org } = await requireOrgAdmin(orgId);
    const r = z.enum(["owner", "admin", "treasurer", "member", "viewer"]).parse(role);
    unwrap(await supabase.from("memberships").update({ role: r }).eq("organization_id", orgId).eq("user_id", userId));
    revalidatePath(`/app/${org.slug}/parametres`);
  });
}

export async function removeMembership(orgId: string, userId: string) {
  return run(async () => {
    const { supabase, org } = await requireOrgAdmin(orgId);
    unwrap(await supabase.from("memberships").delete().eq("organization_id", orgId).eq("user_id", userId));
    revalidatePath(`/app/${org.slug}/parametres`);
  });
}

export async function acceptInvitation(token: string): Promise<ActionResult<never>> {
  let slug = "";
  try {
    await requireUser();
    const supabase = await createClient();
    const orgId = unwrap(await supabase.rpc("accept_invitation", { invite_token: token })) as string;
    const { data } = await supabase.from("organizations").select("slug").eq("id", orgId).single<{ slug: string }>();
    slug = data!.slug;
  } catch (e) {
    return fail(humanizeError(e));
  }
  redirect(`/app/${slug}`);
}

export async function deleteOrganization(orgId: string, confirmName: string): Promise<ActionResult<never>> {
  try {
    const { supabase, org, role } = await requireOrgAdmin(orgId);
    if (role !== "owner") throw new Error("Seul le propriétaire peut supprimer l'association.");
    if (confirmName.trim() !== org.name) throw new Error("Le nom saisi ne correspond pas.");
    // Fichiers du stockage
    const { data: docs } = await supabase.from("documents").select("storage_path").eq("organization_id", orgId);
    if (docs?.length) await supabase.storage.from("documents").remove(docs.map((d) => d.storage_path as string));
    unwrap(await supabase.from("organizations").delete().eq("id", orgId));
  } catch (e) {
    return fail(humanizeError(e));
  }
  redirect("/app");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/connexion");
}

export async function createSupportTicket(orgId: string | null, form: FormData) {
  return run(async () => {
    const user = await requireUser();
    const supabase = await createClient();
    const v = z
      .object({ subject: z.string().trim().min(3, "Sujet trop court.").max(200), message: z.string().trim().min(10, "Message trop court.").max(10000) })
      .parse(Object.fromEntries(form));
    unwrap(await supabase.from("support_tickets").insert({ organization_id: orgId, user_id: user.id, ...v }));
  });
}
