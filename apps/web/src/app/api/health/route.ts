import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/public-env";

export const dynamic = "force-dynamic";

/** Sonde de disponibilité (load balancer, Docker, monitoring). */
export async function GET() {
  const started = Date.now();
  let database = "unknown";
  try {
    const sb = createClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, { auth: { persistSession: false } });
    const { error } = await sb.from("organizations").select("id", { head: true, count: "exact" }).limit(1);
    database = error ? "error" : "ok";
  } catch {
    database = "error";
  }
  const ok = database === "ok";
  return NextResponse.json({ status: ok ? "ok" : "degraded", database, latencyMs: Date.now() - started, version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local" }, { status: ok ? 200 : 503 });
}
