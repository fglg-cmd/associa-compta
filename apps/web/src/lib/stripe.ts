import "server-only";
import Stripe from "stripe";
import { serverEnv } from "./env";
import type { PlanTier } from "./plans";

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!serverEnv.stripeSecretKey) throw new Error("La facturation n'est pas configurée (STRIPE_SECRET_KEY).");
  client ??= new Stripe(serverEnv.stripeSecretKey, { appInfo: { name: "ASSOCIA COMPTA" } });
  return client;
}

export function priceFor(plan: Exclude<PlanTier, "free">, interval: "month" | "year"): string {
  const id = serverEnv.stripePrices[`${plan}_${interval}`];
  if (!id) throw new Error(`Tarif Stripe non configuré pour ${plan} (${interval}).`);
  return id;
}

export function planForPrice(priceId: string | null | undefined): PlanTier {
  const p = serverEnv.stripePrices;
  if (priceId && (priceId === p.pro_month || priceId === p.pro_year)) return "pro";
  if (priceId && (priceId === p.essential_month || priceId === p.essential_year)) return "essential";
  return "free";
}
