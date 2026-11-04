/**
 * Contrat unique des server actions : jamais d'exception vers le client,
 * un message d'erreur lisible en français.
 */
import { ZodError } from "zod";
import { unstable_rethrow } from "next/navigation";

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

export function ok<T>(data: T): ActionResult<T>;
export function ok(): ActionResult<void>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

/** Traduit les erreurs PostgreSQL / Supabase en message utilisateur. */
export function humanizeError(e: unknown): string {
  // Les redirections / notFound de Next.js doivent se propager
  unstable_rethrow(e);
  if (e instanceof ZodError) {
    return e.issues[0]?.message ?? "Données invalides.";
  }
  const err = e as { message?: string; code?: string; details?: string } | null;
  const msg = err?.message ?? "";
  if (err?.code === "23505") return "Cet élément existe déjà.";
  if (err?.code === "42501" && !/[àéèç]/.test(msg)) return "Vous n'avez pas les droits nécessaires pour cette action.";
  if (err?.code === "23503") return "Cet élément est utilisé ailleurs et ne peut pas être supprimé.";
  if (msg && /[àâéèêëîïôûùç]|Écriture|Aucun|Exercice|Cotisation|Mouvement|Compte|Journal/.test(msg)) return msg;
  if (msg.includes("JWT")) return "Votre session a expiré. Reconnectez-vous.";
  console.error("[action]", e);
  return "Une erreur inattendue est survenue. Notre équipe a été prévenue.";
}

export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, error: humanizeError(e) };
  }
}

/** Lève l'erreur Supabase si présente, sinon renvoie la donnée. */
export function unwrap<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data;
}
