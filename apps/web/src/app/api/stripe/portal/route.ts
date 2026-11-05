import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireOrgAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { publicEnv } from "@/lib/public-env";

export const runtime = "nodejs";

/** Portail client Stripe : factures, moyen de paiement, résiliation. */
export async function POST(req: NextRequest) {
  try {
    const { orgId } = z.object({ orgId: z.uuid() }).parse(await req.json());
    const { org } = await requireOrgAdmin(orgId);
    const { data } = await createAdminClient().from("organizations").select("stripe_customer_id").eq("id", org.id).single<{ stripe_customer_id: string | null }>();
    if (!data?.stripe_customer_id) throw new Error("Aucun abonnement associé.");
    const stripe = getStripe();
    // Configuration du portail créée pour ASSOCIA COMPTA (métadonnée associa=1), sinon celle par défaut
    const confs = await stripe.billingPortal.configurations.list({ active: true, limit: 20 });
    const configuration = confs.data.find((c) => c.metadata?.associa === "1")?.id;
    const session = await stripe.billingPortal.sessions.create({ customer: data.stripe_customer_id, configuration, locale: "fr", return_url: `${publicEnv.appUrl}/app/${org.slug}/parametres?onglet=abonnement` });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
