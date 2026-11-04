import "server-only";
import { PostHog } from "posthog-node";
import { serverEnv } from "./env";

let ph: PostHog | null = null;

/** Événement produit côté serveur (aucune donnée financière nominative). */
export async function track(event: string, distinctId: string, properties?: Record<string, unknown>) {
  if (!serverEnv.posthogKey) return;
  ph ??= new PostHog(serverEnv.posthogKey, { host: serverEnv.posthogHost, flushAt: 1, flushInterval: 0 });
  try {
    ph.capture({ event, distinctId, properties });
    await ph.flush();
  } catch {
    // L'analytique ne doit jamais casser un parcours utilisateur.
  }
}
