import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Organization, OrgRole } from "./types";

export interface SessionUser {
  id: string;
  email: string | undefined;
}

/**
 * Utilisateur connecté. Le jeton est vérifié localement (signature ES256, clés publiques
 * mises en cache) : pas d'aller-retour vers le serveur d'authentification à chaque page.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return { id: data.claims.sub, email: typeof data.claims.email === "string" ? data.claims.email : undefined };
});

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/connexion");
  return user;
}

export interface OrgContext {
  org: Organization;
  role: OrgRole;
  userId: string;
  canWrite: boolean;
  canAdmin: boolean;
}

/** Résout l'association depuis son slug ; 404 si l'utilisateur n'y a pas accès. */
export const getOrgContext = cache(async (slug: string): Promise<OrgContext> => {
  const user = await requireUser();
  const supabase = await createClient();
  // Une seule requête : l'adhésion de l'utilisateur et son association (jointure interne).
  const { data: m } = await supabase
    .from("memberships")
    .select("role, organizations!inner(*)")
    .eq("user_id", user.id)
    .eq("organizations.slug", slug)
    .maybeSingle<{ role: OrgRole; organizations: Organization }>();
  if (!m) notFound();
  const org = m.organizations;
  return {
    org,
    role: m.role,
    userId: user.id,
    canWrite: ["owner", "admin", "treasurer"].includes(m.role),
    canAdmin: ["owner", "admin"].includes(m.role),
  };
});

/** Pour les server actions : contexte par identifiant + exigence d'écriture. */
export async function requireOrgWriter(orgId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: m } = await supabase
    .from("memberships")
    .select("role, organizations(id, slug, plan, name)")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle<{ role: OrgRole; organizations: Pick<Organization, "id" | "slug" | "plan" | "name"> }>();
  if (!m || !["owner", "admin", "treasurer"].includes(m.role)) {
    throw Object.assign(new Error("Vous n'avez pas les droits nécessaires pour cette action."), { code: "42501" });
  }
  return { supabase, user, role: m.role, org: m.organizations };
}

export async function requireOrgAdmin(orgId: string) {
  const ctx = await requireOrgWriter(orgId).catch(() => null);
  if (!ctx || !["owner", "admin"].includes(ctx.role)) {
    throw Object.assign(new Error("Action réservée aux administrateurs de l'association."), { code: "42501" });
  }
  return ctx;
}

export async function requireOrgMember(orgId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: m } = await supabase
    .from("memberships")
    .select("role, organizations(id, slug, plan, name)")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle<{ role: OrgRole; organizations: Pick<Organization, "id" | "slug" | "plan" | "name"> }>();
  if (!m) throw Object.assign(new Error("Accès refusé."), { code: "42501" });
  return { supabase, user, role: m.role, org: m.organizations };
}

export async function isPlatformAdmin(): Promise<boolean> {
  const user = await getSessionUser();
  if (!user) return false;
  const supabase = await createClient();
  const { data } = await supabase.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  return Boolean(data);
}

/** Garde explicite pour chaque page du back-office (en plus du layout). */
export async function assertPlatformAdmin() {
  if (!(await isPlatformAdmin())) notFound();
}
