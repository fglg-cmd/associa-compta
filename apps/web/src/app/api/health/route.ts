import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/public-env";

export const dynamic = "force-dynamic";

/**
 * Sonde de disponibilité (load balancer, Docker, monitoring).
 * Indique aussi si chaque intégration est configurée — jamais les valeurs.
 */
export async function GET() {
  const started = Date.now();
  const opts = { auth: { persistSession: false } };

  let database = "error";
  try {
    const sb = createClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, opts);
    const { error } = await sb.from("organizations").select("id", { head: true, count: "exact" }).limit(1);
    database = error ? "error" : "ok";
  } catch {}

  let serverKey = "missing";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (key) {
    try {
      const admin = createClient(publicEnv.supabaseUrl, key, opts);
      const { error } = await admin.from("subscriptions").select("organization_id", { head: true, count: "exact" }).limit(1);
      serverKey = error ? "invalid" : "ok";
    } catch {
      serverKey = "invalid";
    }
  }

  const configured = (v?: string) => (v && v.trim() ? "configured" : "missing");
  const ok = database === "ok";
  return NextResponse.json(
    {
      status: ok ? "ok" : "degraded",
      database,
      serverKey,
      integrations: {
        stripe: configured(process.env.STRIPE_SECRET_KEY),
        email: configured(process.env.RESEND_API_KEY),
        ai: process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY ? "configured" : "missing",
        cron: configured(process.env.CRON_SECRET),
      },
      latencyMs: Date.now() - started,
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
