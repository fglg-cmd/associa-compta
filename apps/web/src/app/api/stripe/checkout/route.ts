import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireOrgAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, priceFor } from "@/lib/stripe";
import { publicEnv } from "@/lib/public-env";

export const runtime = "nodejs";

/** Crée une session Stripe Checkout pour souscrire un abonnement. */
export async function POST(req: NextRequest) {
  try {
    const body = z.object({ orgId: z.uuid(), plan: z.enum(["essential", "pro"]), interval: z.enum(["month", "year"]) }).parse(await req.json());
    const { org, user } = await requireOrgAdmin(body.orgId);
    const stripe = getStripe();
    const admin = createAdminClient();
    const { data: full } = await admin.from("organizations").select("name, email, stripe_customer_id").eq("id", org.id).single<{ name: string; email: string | null; stripe_customer_id: string | null }>();

    let customer = full!.stripe_customer_id;
    if (!customer) {
      const c = await stripe.customers.create({ name: full!.name, email: full!.email ?? user.email, metadata: { organization_id: org.id }, preferred_locales: ["fr"] });
      customer = c.id;
      await admin.from("organizations").update({ stripe_customer_id: customer }).eq("id", org.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer,
      line_items: [{ price: priceFor(body.plan, body.interval), quantity: 1 }],
      client_reference_id: org.id,
      subscription_data: { metadata: { organization_id: org.id } },
      metadata: { organization_id: org.id },
      allow_promotion_codes: true,
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      customer_update: { address: "auto", name: "auto" },
      locale: "fr",
      success_url: `${publicEnv.appUrl}/app/${org.slug}/parametres?onglet=abonnement&statut=succes`,
      cancel_url: `${publicEnv.appUrl}/app/${org.slug}/parametres?onglet=abonnement`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
