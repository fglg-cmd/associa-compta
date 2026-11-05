/**
 * Configuration typée. Les variables publiques sont lues explicitement pour
 * que Next.js les inline dans le bundle client.
 * Les intégrations optionnelles (Stripe, Resend, IA, OCR…) se désactivent
 * proprement quand leur clé est absente : l'UI l'indique, rien n'est simulé.
 */
import "server-only";

function opt(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

function req(name: string): string {
  const v = opt(name);
  if (!v) throw new Error(`Variable d'environnement manquante : ${name}`);
  return v;
}

export const serverEnv = {
  get supabaseServiceRoleKey() {
    return req("SUPABASE_SERVICE_ROLE_KEY");
  },
  stripeSecretKey: opt("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: opt("STRIPE_WEBHOOK_SECRET"),
  stripePrices: {
    essential_month: opt("STRIPE_PRICE_ESSENTIAL_MONTHLY"),
    essential_year: opt("STRIPE_PRICE_ESSENTIAL_YEARLY"),
    pro_month: opt("STRIPE_PRICE_PRO_MONTHLY"),
    pro_year: opt("STRIPE_PRICE_PRO_YEARLY"),
  },
  resendApiKey: opt("RESEND_API_KEY"),
  emailFrom: opt("EMAIL_FROM") ?? "ASSOCIA COMPTA <bonjour@associa-compta.fr>",
  anthropicApiKey: opt("ANTHROPIC_API_KEY"),
  aiModel: opt("AI_MODEL") ?? "claude-opus-5-5",
  anthropicWorkspaceId: opt("ANTHROPIC_WORKSPACE_ID"),
  openaiApiKey: opt("OPENAI_API_KEY"),
  openaiModel: opt("OPENAI_MODEL") ?? "gpt-5.1",
  googleVisionApiKey: opt("GOOGLE_VISION_API_KEY"),
  cronSecret: opt("CRON_SECRET"),
  posthogKey: opt("NEXT_PUBLIC_POSTHOG_KEY"),
  posthogHost: opt("NEXT_PUBLIC_POSTHOG_HOST") ?? "https://eu.i.posthog.com",
};

export const features = {
  /** Paiement proposé : Stripe configuré ET hors phase de lancement gratuite. */
  get billing() { return Boolean(serverEnv.stripeSecretKey) && process.env.BETA_FREE !== "on"; },
  get beta() { return process.env.BETA_FREE === "on"; },
  get email() { return Boolean(serverEnv.resendApiKey); },
  /** IA active : une clé est présente et AI_ENABLED n'est pas « off » (coupure sans supprimer la clé). */
  get ai() { return process.env.AI_ENABLED !== "off" && Boolean(serverEnv.anthropicApiKey || serverEnv.openaiApiKey); },
};
