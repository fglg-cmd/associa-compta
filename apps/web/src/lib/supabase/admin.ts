import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "../env";
import { publicEnv } from "../public-env";

/**
 * Client « service role » : contourne la RLS.
 * Réservé aux webhooks, tâches planifiées et au back-office (après contrôle
 * explicite de is_platform_admin). Ne jamais l'exposer au client.
 */
export function createAdminClient() {
  return createClient(publicEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
