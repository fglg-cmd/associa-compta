import { defineConfig, devices } from "@playwright/test";

/**
 * Tests de bout en bout contre une instance Supabase réelle (locale : `npx supabase start`).
 * Variables requises : NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
 * Lancement : pnpm --filter @associa/web build && pnpm --filter @associa/web e2e
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", locale: "fr-FR", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL ? undefined : { command: "pnpm start", port: 3000, reuseExistingServer: true, timeout: 60_000 },
});
