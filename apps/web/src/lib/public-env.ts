export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  /** Adresse publique : variable explicite, sinon domaine de production Vercel (fourni automatiquement). */
  appUrl: (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    "http://localhost:3000"
  ).replace(/\/$/, ""),
  /** Fournisseurs OAuth activés dans Supabase, ex. "google,azure". Vide = connexion par e-mail uniquement. */
  authProviders: (process.env.NEXT_PUBLIC_AUTH_PROVIDERS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  /** "on" si un service d'e-mail (SMTP personnalisé) est branché sur Supabase Auth : lien magique et mot de passe oublié. */
  authEmails: process.env.NEXT_PUBLIC_AUTH_EMAILS === "on",
  supportEmail: process.env.NEXT_PUBLIC_LEGAL_EMAIL || "associacompta@gmail.com",
  posthogKey: process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "",
  posthogHost: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
  sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? "",
};
