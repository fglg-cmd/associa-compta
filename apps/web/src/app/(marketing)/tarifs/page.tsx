import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { formatEUR } from "@associa/accounting";
import { PLANS, planFeatures } from "@/lib/plans";
import { features } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Tarifs" };

const FAQ = [
  ["Puis-je changer d'offre à tout moment ?", "Oui, depuis les paramètres de votre association. Le changement est immédiat et proratisé par Stripe."],
  ["Mes données m'appartiennent-elles ?", "Oui. Vous pouvez exporter à tout moment l'intégralité de votre comptabilité (FEC, Excel, PDF) et supprimer votre espace."],
  ["Recevrai-je une facture ?", "Oui, une facture conforme est émise à chaque échéance et disponible dans votre espace de facturation."],
  ["Que se passe-t-il si je résilie ?", "Votre abonnement reste actif jusqu'à la fin de la période payée, puis votre association repasse en offre Découverte, sans perte de données."],
];


export default function PricingPage() {
  const plans = Object.values(PLANS);
  return (
    <main className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-48 h-[620px] bg-[radial-gradient(ellipse_50%_45%_at_50%_35%,color-mix(in_oklch,var(--accent)_16%,transparent),transparent)]" />
      <div className="relative mx-auto max-w-6xl px-5 pt-16 pb-24 sm:pt-24">
        <p className="text-center text-[12.5px] font-semibold uppercase tracking-[0.12em] text-accent">Tarifs</p>
        <h1 className="mx-auto mt-3 max-w-3xl text-center text-[36px] leading-[1.08] font-semibold tracking-[-0.04em] text-balance sm:text-[52px]">Des tarifs simples, pensés pour les associations</h1>
        <p className="mx-auto mt-5 max-w-lg text-center text-[16px] text-muted">Toutes les offres incluent la comptabilité en partie double, le bilan et le compte de résultat. Prix HT, -17&nbsp;% en paiement annuel.</p>
        {features.beta && (
          <div className="mx-auto mt-8 flex max-w-2xl items-start gap-3 rounded-2xl border border-accent/30 bg-accent-soft/60 px-5 py-4 text-left text-[14px]">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-accent" />
            <p><strong className="text-accent">Phase de lancement : tout est gratuit.</strong> Toutes les fonctionnalités sont offertes, sans limite, pendant la phase de lancement. Les tarifs ci-dessous s&apos;appliqueront ensuite, avec un préavis d&apos;au moins un mois.</p>
          </div>
        )}
        <div className="mt-14 grid items-stretch gap-5 md:grid-cols-3">
          {plans.map((p) => {
            const featured = p.tier === "essential";
            return (
              <div
                key={p.tier}
                className={cn(
                  "relative flex flex-col rounded-2xl border bg-surface p-7",
                  featured ? "border-accent shadow-[0_24px_60px_-24px_color-mix(in_oklch,var(--accent)_55%,transparent)] ring-4 ring-accent/10 md:-my-3 md:py-10" : "border-border shadow-xs",
                )}
              >
                {featured && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-[11.5px] font-semibold text-white shadow-sm">Recommandé</span>}
                <h2 className="text-[17px] font-semibold">{p.name}</h2>
                <p className="mt-0.5 text-[13.5px] text-muted">{p.tagline}</p>
                <div className="mt-6 flex items-baseline gap-1.5">
                  <span className="text-[44px] leading-none font-semibold tracking-[-0.04em] tabular">{p.monthly ? formatEUR(p.monthly).replace(",00", "") : "0 €"}</span>
                  <span className="text-[14px] text-muted">HT / mois</span>
                </div>
                <p className="mt-2 text-[13px] text-muted">{p.yearly ? `ou ${formatEUR(p.yearly).replace(",00", "")} HT par an` : "Pour toujours"}</p>
                <Button asChild variant={featured ? "primary" : "secondary"} size="lg" className="mt-6 h-11 rounded-lg">
                  <Link href="/inscription">{p.tier === "free" || features.beta ? "Commencer gratuitement" : "Essayer, puis choisir cette offre"}</Link>
                </Button>
                <div className="my-6 h-px bg-border" />
                <ul className="grid flex-1 content-start gap-2.5 text-[14px]">
                  {planFeatures(p, features.ai).map((f) => (
                    <li key={f} className="flex gap-2.5">
                      <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full", featured ? "bg-accent text-white" : "bg-positive-soft text-positive")}><Check className="size-2.5" strokeWidth={3} /></span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <div className="mx-auto mt-24 max-w-2xl">
          <h2 className="mb-6 text-center text-[28px] font-semibold tracking-[-0.03em]">Questions fréquentes</h2>
          <div className="divide-y divide-border border-y border-border">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group py-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15.5px] font-medium">
                  {q}
                  <span className="grid size-6 shrink-0 place-items-center rounded-full border border-border text-muted transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 pr-10 text-[14.5px] leading-relaxed text-muted">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
