import Link from "next/link";
import { Check } from "lucide-react";
import { formatEUR } from "@associa/accounting";
import { PLANS, planFeatures } from "@/lib/plans";
import { features } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Tarifs" };

const FAQ = [
  ["Puis-je changer d'offre à tout moment ?", "Oui, depuis les paramètres de votre association. Le changement est immédiat et proratisé par Stripe."],
  ["Mes données m'appartiennent-elles ?", "Oui. Vous pouvez exporter à tout moment l'intégralité de votre comptabilité (FEC, Excel, PDF) et supprimer votre espace."],
  ["Recevrai-je une facture ?", "Oui, une facture conforme est émise à chaque échéance et disponible dans votre espace de facturation."],
  ["Que se passe-t-il si je résilie ?", "Votre abonnement reste actif jusqu'à la fin de la période payée, puis votre association repasse en offre Découverte, sans perte de données."],
];

export const dynamic = "force-dynamic";

export default function PricingPage() {
  const plans = Object.values(PLANS);
  return (
    <main className="mx-auto max-w-6xl px-5 py-20">
      <h1 className="text-center text-4xl font-semibold tracking-[-0.03em]">Des tarifs simples, pensés pour les associations</h1>
      <p className="mx-auto mt-3 max-w-lg text-center text-muted">Toutes les offres incluent la comptabilité en partie double, le bilan et le compte de résultat. Prix HT, -17 % en paiement annuel.</p>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {plans.map((p) => (
          <div key={p.tier} className={cn("flex flex-col rounded-2xl border bg-surface p-6 shadow-xs", p.tier === "essential" ? "border-accent shadow-md" : "border-border")}>
            <div className="flex items-center justify-between"><h2 className="font-semibold">{p.name}</h2>{p.tier === "essential" && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">Le plus choisi</span>}</div>
            <p className="text-[13px] text-muted">{p.tagline}</p>
            <div className="mt-5"><span className="text-4xl font-semibold tracking-tight tabular">{p.monthly ? formatEUR(p.monthly).replace(",00", "") : "0 €"}</span><span className="text-muted"> HT / mois</span></div>
            <p className="text-xs text-muted">{p.yearly ? `ou ${formatEUR(p.yearly).replace(",00", "")} HT par an` : "Pour toujours"}</p>
            <ul className="mt-6 grid flex-1 gap-2 text-[13.5px]">{planFeatures(p, features.ai).map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-positive" />{f}</li>)}</ul>
            <Button asChild variant={p.tier === "essential" ? "primary" : "secondary"} size="lg" className="mt-6"><Link href="/inscription">{p.tier === "free" ? "Commencer gratuitement" : "Essayer, puis choisir cette offre"}</Link></Button>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-20 max-w-2xl">
        <h2 className="mb-6 text-center text-2xl font-semibold">Questions fréquentes</h2>
        {FAQ.map(([q, a]) => (
          <details key={q} className="border-b border-border py-4"><summary className="cursor-pointer font-medium">{q}</summary><p className="mt-2 text-[14px] text-muted">{a}</p></details>
        ))}
      </div>
    </main>
  );
}
