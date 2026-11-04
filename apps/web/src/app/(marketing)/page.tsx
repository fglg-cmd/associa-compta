import Link from "next/link";
import { ArrowRight, Bot, Check, FileSearch, FolderKanban, Landmark, Lock, PieChart, Receipt, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/lib/plans";
import { formatEUR } from "@associa/accounting";

const FEATURES = [
  { icon: Landmark, title: "Banque automatisée", text: "Importez vos relevés CSV, OFX ou QIF de n'importe quelle banque française. Doublons détectés, catégories proposées, règles apprises à chaque validation." },
  { icon: Receipt, title: "Comptabilité invisible", text: "Chaque mouvement devient une écriture en partie double, conforme au plan comptable associatif. Vous parlez « recettes et dépenses », le logiciel parle 706 et 512." },
  { icon: FileSearch, title: "Justificatifs lus par l'OCR", text: "Photographiez un ticket ou déposez une facture : montant, date et fournisseur sont extraits puis rattachés au bon mouvement bancaire." },
  { icon: Users, title: "Adhérents et cotisations", text: "Fichier des membres, appels de cotisation, encaissements comptabilisés automatiquement, relances par e-mail programmées." },
  { icon: FolderKanban, title: "Projets et événements", text: "Un budget par kermesse, tournoi ou séjour, le réalisé en temps réel et la rentabilité de chaque événement." },
  { icon: PieChart, title: "Rapports en un clic", text: "Compte de résultat, bilan, balance, grand livre, FEC. En PDF, Excel ou CSV, prêts pour l'assemblée générale." },
];

export default function Landing() {
  return (
    <main>
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-40 h-[640px] bg-[radial-gradient(ellipse_55%_45%_at_50%_30%,color-mix(in_oklch,var(--accent)_16%,transparent),transparent)]" />
        <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-20 text-center sm:pt-28">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted shadow-xs"><Sparkles className="size-3.5 text-accent" /> Avec un assistant financier propulsé par l&apos;IA</span>
          <h1 className="mx-auto mt-6 max-w-3xl text-[40px] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-[58px]">La comptabilité de votre association, <span className="text-accent">enfin simple.</span></h1>
          <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-muted">Importez vos relevés, validez les catégories proposées : ASSOCIA COMPTA tient une comptabilité en partie double conforme, prête pour votre assemblée générale.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild variant="primary" size="lg" className="h-11 px-5 text-[15px]"><Link href="/inscription">Commencer gratuitement <ArrowRight /></Link></Button>
            <Button asChild size="lg" className="h-11 px-5 text-[15px]"><Link href="/tarifs">Voir les tarifs</Link></Button>
          </div>
          <p className="mt-4 text-xs text-subtle">Gratuit jusqu&apos;à 50 adhérents · Sans carte bancaire · Prêt en deux minutes</p>

          <div className="mx-auto mt-16 max-w-4xl rounded-2xl border border-border bg-surface p-2 text-left shadow-lg">
            <div className="rounded-xl border border-border bg-background p-5">
              <div className="mb-4 flex items-center justify-between"><span className="text-[13px] font-semibold">Du relevé bancaire au bilan, sans saisie</span><span className="text-[11px] text-subtle">Illustration du fonctionnement</span></div>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  { step: "1", t: "Vous importez", lines: ["CB LEROY MERLIN 12/03", "VIR SEPA RECU /FRM DUPONT", "PRLV SEPA MAIF"] },
                  { step: "2", t: "Il catégorise", lines: ["Fournitures et petit matériel", "Cotisations des adhérents", "Assurances"] },
                  { step: "3", t: "Vous présentez", lines: ["Compte de résultat", "Bilan équilibré", "Rapport financier d'AG"] },
                ].map((c) => (
                  <div key={c.step} className="rounded-lg border border-border bg-surface p-4">
                    <div className="mb-3 flex items-center gap-2 text-[13px] font-medium"><span className="grid size-5 place-items-center rounded-full bg-accent text-[11px] text-white">{c.step}</span>{c.t}</div>
                    <ul className="grid gap-1.5">{c.lines.map((l) => <li key={l} className="flex items-center gap-2 rounded-md bg-surface-2 px-2.5 py-1.5 text-xs"><Check className="size-3 text-positive" />{l}</li>)}</ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="fonctionnalites" className="border-t border-border bg-surface/50">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="text-center text-3xl font-semibold tracking-[-0.025em]">Tout ce dont un trésorier a besoin. Rien de plus.</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted">Pensé pour les bénévoles sans formation comptable, assez rigoureux pour votre expert-comptable.</p>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-border bg-surface p-5 shadow-xs">
                <span className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent"><f.icon className="size-[18px]" /></span>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{f.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-xs md:flex md:items-center md:gap-8">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-white"><Bot className="size-5" /></span>
            <div className="mt-4 md:mt-0">
              <h3 className="font-semibold">Un assistant financier qui connaît vos comptes</h3>
              <p className="mt-1 text-[13.5px] text-muted">« Notre trésorerie tiendra-t-elle jusqu&apos;en juin ? », « Explique-moi les fonds dédiés », « Rédige le rapport financier de l&apos;AG » : il répond à partir de vos chiffres réels, sans jamais les inventer.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="securite" className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold tracking-[-0.025em]">La confiance, par construction.</h2>
            <p className="mt-3 text-muted">Les règles comptables sont garanties par la base de données elle-même, pas seulement par l&apos;interface.</p>
          </div>
          <ul className="grid gap-4 text-[14px]">
            {[
              [ShieldCheck, "Écritures toujours équilibrées", "Une écriture validée ne peut être ni déséquilibrée, ni modifiée : on la corrige par contre-passation, comme l'exige la loi."],
              [Lock, "Isolation stricte des données", "Chaque association est cloisonnée au niveau de la base (Row Level Security). Personne d'autre ne voit vos comptes."],
              [Landmark, "Hébergement européen, RGPD", "Données hébergées dans l'Union européenne, chiffrées au repos et en transit, exportables et supprimables à tout moment."],
              [Users, "Rôles et piste d'audit", "Trésorier, membre du bureau, lecteur pour le vérificateur aux comptes. Chaque action est tracée."],
            ].map(([I, t, d]) => {
              const Icon = I as typeof Lock;
              return <li key={t as string} className="flex gap-3"><Icon className="mt-0.5 size-5 shrink-0 text-accent" /><span><strong className="font-semibold">{t as string}</strong><br /><span className="text-muted">{d as string}</span></span></li>;
            })}
          </ul>
        </div>
      </section>

      <section className="border-t border-border bg-surface/50">
        <div className="mx-auto max-w-6xl px-5 py-20 text-center">
          <h2 className="text-3xl font-semibold tracking-[-0.025em]">Un prix d&apos;association.</h2>
          <p className="mt-3 text-muted">Gratuit pour démarrer, puis {formatEUR(PLANS.essential.monthly).replace(",00", "")} HT par mois pour tout débloquer.</p>
          <Button asChild variant="primary" size="lg" className="mt-8 h-11 px-5"><Link href="/inscription">Créer mon espace gratuit <ArrowRight /></Link></Button>
        </div>
      </section>
    </main>
  );
}
