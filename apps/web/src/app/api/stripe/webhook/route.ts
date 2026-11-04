import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, planForPrice } from "@/lib/stripe";
import { track } from "@/lib/analytics";

export const runtime = "nodejs";

async function syncSubscription(sub: Stripe.Subscription) {
  const admin = createAdminClient();
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  let orgId: string | undefined = sub.metadata?.organization_id;
  if (!orgId) {
    const { data } = await admin.from("organizations").select("id").eq("stripe_customer_id", customerId).maybeSingle<{ id: string }>();
    orgId = data?.id;
  }
  if (!orgId) throw new Error(`Organisation introuvable pour ${customerId}`);
  const item = sub.items.data[0];
  const price = item?.price;
  const active = ["active", "trialing", "past_due"].includes(sub.status);
  const plan = active ? planForPrice(price?.id) : "free";
  await admin.from("subscriptions").upsert({
    organization_id: orgId,
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    stripe_price_id: price?.id ?? null,
    plan,
    status: sub.status,
    interval: price?.recurring?.interval ?? null,
    amount: price?.unit_amount ?? null,
    current_period_end: item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null,
    cancel_at_period_end: sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  });
  await admin.from("organizations").update({ plan, stripe_customer_id: customerId }).eq("id", orgId);
  await track("subscription_synced", orgId, { plan, status: sub.status });
}

export async function POST(req: NextRequest) {
  if (!serverEnv.stripeWebhookSecret) return NextResponse.json({ error: "Webhook non configuré" }, { status: 503 });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Signature manquante" }, { status: 400 });
  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(await req.text(), signature, serverEnv.stripeWebhookSecret);
  } catch {
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  const admin = createAdminClient();
  // Idempotence : chaque événement n'est traité qu'une fois
  const { error: dup } = await admin.from("stripe_events").insert({ id: event.id, type: event.type });
  if (dup?.code === "23505") return NextResponse.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object;
        if (s.mode === "subscription" && s.subscription) {
          const sub = await stripe.subscriptions.retrieve(typeof s.subscription === "string" ? s.subscription : s.subscription.id);
          if (!sub.metadata?.organization_id && s.client_reference_id) sub.metadata = { ...sub.metadata, organization_id: s.client_reference_id };
          await syncSubscription(sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object);
        break;
      default:
        break;
    }
  } catch (e) {
    // On libère l'événement pour que Stripe le renvoie
    await admin.from("stripe_events").delete().eq("id", event.id);
    console.error("[stripe webhook]", e);
    return NextResponse.json({ error: "Traitement impossible" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
