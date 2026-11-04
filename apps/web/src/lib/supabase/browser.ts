"use client";
import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "../public-env";

let client: ReturnType<typeof createBrowserClient> | undefined;

export function getBrowserClient() {
  client ??= createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
  return client;
}
