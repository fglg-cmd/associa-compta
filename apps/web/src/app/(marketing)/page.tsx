import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Check,
  FileCheck2,
  FileSearch,
  FolderKanban,
  Landmark,
  Lock,
  PieChart,
  Receipt,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/lib/plans";
import { formatEUR } from "@associa/accounting";
import { features } from "@/lib/env";
import { cn } from "@/lib/utils";
import { ProductPreview } from "./product-preview";

export const dynamic = "force-dynamic";

const TRUST = [
  { icon: ScrollText, label: "Conforme au règlement ANC 2018-06" },
  { icon: FileCheck2, label: "Export FEC pour l'expert-comptable" },
  { icon: Landmark, label: "Toutes banques : CSV, OFX, QIF" },
  { icon: Lock, label: "Données hébergées dans l'UE" },
];

const AUDIENCES = ["Clubs sportifs", "Associations culturelles", "Parents d'élèves", "Comités des fêtes", "Associations caritatives", "Amicales et anciens", "Structures employeuses"];

const STEPS = [
  {
    icon: Upload,
    t: "Importez vos relevés",
    d: "Exportez le relevé depuis votre banque, déposez-le. Les doublons sont écartés automatiquement.",
    lines: ["CB LEROY MERLIN 12/03", "VIR SEPA RECU /FRM DUPONT", "PRLV SEPA MAIF"],
    mono: true,
  },
  {
    icon: Wand2,
    t: "Validez les catégories",
    d: "Chaque mouvement reçoit une catégorie proposée. Un clic suffit, et les règles s'affinent à chaque validation.",
    lines: ["Fournitures et petit matériel", "Cotisations des adhérents", "Assurances"],
  },
  {
    icon: PieChart,
    t: "Présentez vos comptes",
    d: "Compte de résultat, bilan et rapport financier sont à jour en permanence, prêts pour l'assemblée générale.",
    lines: ["Compte de résultat", "Bilan équilibré", "Rapport financier d'AG"],
  },
];

const FEATURES = [
  { icon: Users, title: "Adhérents et cotisations", text: "Fichier des membres, appels de cotisation, encaissements comptabilisés automatiquement et relances par e-mail programmées." },
  { icon: FolderKanban, title: "Projets et événements", text: "Un budget par kermesse, tournoi ou séjour, le réalisé en temps réel et la rentabilité de chaque événement." },
  { icon: FileSearch, title: "Justificatifs lus par l'OCR", text: "Photographiez un ticket ou déposez une facture : montant, date et fournisseur sont extraits puis rattachés au bon mouvement." },
  { icon: PieChart, title: "Rapports en un clic", text: "Compte de résultat, bilan, balance, grand livre et FEC. En PDF, Excel ou CSV." },
];

const SECURITY = [
  { icon: ShieldCheck, t: "Écritures toujours équilibrées", d: "Une écriture validée ne peut être ni déséquilibrée, ni modifiée : on la corrige par contre-passation, comme l'exige la loi." },
  { icon: Lock, t: "Isolation stricte des données", d: "Chaque association est cloisonnée au niveau de la base (Row Level Security). Personne d'autre ne voit vos comptes." },
  { icon: Landmark, t: "Hébergement européen, RGPD", d: "Données hébergées dans l'Union européenne, chiffrées au repos et en transit, exportables et supprimables à tout moment." },
  { icon: Users, t: "Rôles et piste d'audit", d: "Trésorier, membre du bureau, lecteur pour le vérificateur aux comptes. Chaque action est tracée." },
];

function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-[12.5px] font-semibold uppercase tracking-[0.12em] text-accent", className)}>{children}</p>;
}

export default function Landing() {
  const ai = features.ai;
  const beta = features.beta;
  const price = formatEUR(PLANS.essential.monthly).replace(",00", "");

  const faq: [string, string][] = [
    ["Faut-il des connaissances en comptabilité ?", "Non. Vous manipulez des recettes, des dépenses et des catégories en français. Le logiciel traduit tout en écritures en partie double conformes au plan comptable associatif."],
    ["Mon expert-comptable pourra-t-il travailler avec ?", "Oui. Vous pouvez lui donner un accès en lecture, ou lui transmettre le grand livre, la balance et le Fichier des Écritures Comptables (FEC) en un clic."],
    ["Ma banque est-elle compatible ?", "Toutes les banques françaises proposent l'export de relevés en CSV, OFX ou QIF depuis leur espace en ligne. ASSOCIA COMPTA lit ces trois formats."],
    ["Plusieurs membres du bureau peuvent-ils l'utiliser ?", "Oui. Invitez le président, le trésorier adjoint ou le vérificateur aux comptes, chacun avec un rôle adapté : écriture, consultation ou administration."],
    ["Combien ça coûte ?", beta ? "Rien pendant la phase de lancement : toutes les fonctionnalités sont offertes, sans carte bancaire. Les tarifs s'appliqueront ensuite, avec un préavis d'au moins un mois." : `L'offre Découverte est gratuite jusqu'à 50 adhérents, sans limite de durée. L'offre Essentiel est à ${price} HT par mois.`],
  ];

  return (
    <main>
      {/* ——— Hero ——— */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:56px_56px] opacity-60 [mask-image:radial-gradient(ellipse_70%_55%_at_50%_0%,#000_30%,transparent_100%)]" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-48 h-[720px] bg-[radial-gradient(ellipse_50%_45%_at_50%_35%,color-mix(in_oklch,var(--accent)_20%,transparent),transparent)]" />
        <div className="relative mx-auto max-w-6xl px-5 pt-16 pb-24 text-center sm:pt-24">
          <Link href={beta ? "/tarifs" : "/inscription"} className="group inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-surface/80 py-1 pr-3 pl-1 text-[12.5px] text-muted shadow-xs backdrop-blur transition-colors hover:border-border-strong hover:text-foreground">
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent"><Sparkles className="size-3" />{beta ? "Lancement" : ai ? "Nouveau" : "Conforme"}</span>
            <span className="truncate">{beta ? "Toutes les fonctionnalités offertes pendant le lancement" : ai ? "Un assistant financier qui connaît vos comptes" : "Au plan comptable associatif ANC 2018-06"}</span>
            <ArrowRight className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <h1 className="mx-auto mt-7 max-w-4xl text-[42px] leading-[1.04] font-semibold tracking-[-0.045em] text-balance sm:text-[68px]">
            La comptabilité de votre association,{" "}
            <span className="bg-[linear-gradient(100deg,var(--accent),color-mix(in_oklch,var(--accent)_55%,#c026d3))] bg-clip-text text-transparent">enfin simple.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-[560px] text-[17px] leading-relaxed text-pretty text-muted sm:text-lg">
            Importez vos relevés, validez les catégories proposées : ASSOCIA COMPTA tient une comptabilité en partie double conforme, prête pour votre assemblée générale.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild variant="primary" size="lg" className="h-12 rounded-lg px-6 text-[15px] shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_8px_24px_-8px_color-mix(in_oklch,var(--accent)_70%,transparent)]">
              <Link href="/inscription">Commencer gratuitement <ArrowRight /></Link>
            </Button>
            <Button asChild size="lg" className="h-12 rounded-lg px-6 text-[15px]">
              <Link href="/#fonctionnement">Voir comment ça marche</Link>
            </Button>
          </div>
          <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[13px] text-muted">
            {[beta ? "Gratuit pendant le lancement" : "Gratuit jusqu'à 50 adhérents", "Sans carte bancaire", "Prêt en deux minutes"].map((t) => (
              <li key={t} className="flex items-center gap-1.5"><Check className="size-3.5 text-positive" />{t}</li>
            ))}
          </ul>

          <div className="mt-16 sm:mt-20">
            <ProductPreview />
          </div>
        </div>
      </section>

      {/* ——— Bandeau de confiance ——— */}
      <section aria-label="Garanties" className="border-y border-border bg-surface/60">
        <ul className="mx-auto grid max-w-6xl gap-x-6 gap-y-3.5 px-5 py-6 sm:grid-cols-2 text-[13px] text-muted lg:grid-cols-4">
          {TRUST.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2.5"><Icon className="size-4 shrink-0 text-foreground/70" />{label}</li>
          ))}
        </ul>
      </section>

      {/* ——— Pour qui ——— */}
      <section className="mx-auto max-w-6xl px-5 pt-20 text-center">
        <p className="text-[14px] text-muted">Pensé pour les bénévoles de toutes les associations loi 1901</p>
        <ul className="mx-auto mt-4 flex max-w-3xl flex-wrap justify-center gap-2">
          {AUDIENCES.map((a) => <li key={a} className="rounded-full border border-border bg-surface px-3 py-1 text-[13px] font-medium shadow-xs">{a}</li>)}
        </ul>
      </section>

      {/* ——— Comment ça marche ——— */}
      <section id="fonctionnement" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>Comment ça marche</Eyebrow>
          <h2 className="mt-3 text-[32px] leading-tight font-semibold tracking-[-0.03em] text-balance sm:text-[40px]">Du relevé bancaire au bilan, sans saisie.</h2>
          <p className="mt-4 text-[16px] text-muted">Trois gestes par mois. Le reste, ASSOCIA COMPTA s&apos;en occupe.</p>
        </div>
        <ol className="relative mt-14 grid gap-5 md:grid-cols-3">
          <div aria-hidden className="absolute top-[30px] right-[16%] left-[16%] hidden h-px bg-[linear-gradient(to_right,transparent,var(--border-strong)_15%,var(--border-strong)_85%,transparent)] md:block" />
          {STEPS.map((s, i) => (
            <li key={s.t} className="relative flex flex-col items-center text-center">
              <span className="relative grid size-[60px] place-items-center rounded-2xl border border-border bg-surface shadow-sm">
                <s.icon className="size-6 text-accent" />
                <span className="absolute -top-2 -right-2 grid size-5 place-items-center rounded-full bg-foreground text-[10.5px] font-semibold text-background">{i + 1}</span>
              </span>
              <h3 className="mt-5 text-[17px] font-semibold tracking-[-0.01em]">{s.t}</h3>
              <p className="mt-2 max-w-xs text-[14px] leading-relaxed text-muted">{s.d}</p>
              <ul className="mt-5 grid w-full max-w-[300px] gap-1.5 rounded-xl border border-border bg-surface p-2.5 text-left shadow-xs">
                {s.lines.map((l) => (
                  <li key={l} className={cn("flex items-center gap-2 rounded-md bg-surface-2 px-2.5 py-1.5 text-[12px]", s.mono && "font-mono text-[11px] text-muted")}>
                    <Check className="size-3 shrink-0 text-positive" />{l}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      {/* ——— Fonctionnalités ——— */}
      <section id="fonctionnalites" className="scroll-mt-20 border-t border-border bg-surface/50">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <div className="max-w-2xl">
            <Eyebrow>Fonctionnalités</Eyebrow>
            <h2 className="mt-3 text-[32px] leading-tight font-semibold tracking-[-0.03em] text-balance sm:text-[40px]">Tout ce dont un trésorier a besoin. Rien de plus.</h2>
            <p className="mt-4 text-[16px] text-muted">Pensé pour les bénévoles sans formation comptable, assez rigoureux pour votre expert-comptable.</p>
          </div>

          <div className="mt-12 grid gap-4 lg:grid-cols-2">
            {/* Banque */}
            <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xs">
              <div className="p-6 pb-0">
                <span className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent"><Landmark className="size-[18px]" /></span>
                <h3 className="mt-4 text-[17px] font-semibold">Banque automatisée</h3>
                <p className="mt-1.5 max-w-md text-[14px] leading-relaxed text-muted">Importez vos relevés CSV, OFX ou QIF de n&apos;importe quelle banque française. Doublons détectés, catégories proposées, règles apprises à chaque validation.</p>
              </div>
              <div className="mt-6 flex-1 px-6">
                <div className="h-full rounded-t-xl border border-b-0 border-border bg-background p-3">
                  {[
                    ["VIR SEPA RECU /FRM MARTIN", "Cotisations des adhérents", "+ 45,00 €", true],
                    ["CB DECATHLON RENNES", "Matériel sportif", "− 129,90 €", false],
                    ["PRLV SEPA EDF", "Énergie", "− 64,20 €", false],
                  ].map(([l, c, a, p]) => (
                    <div key={l as string} className="flex items-center gap-3 border-b border-border py-2 last:border-0">
                      <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted">{l}</span>
                      <span className="hidden items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent sm:inline-flex"><Sparkles className="size-3" />{c}</span>
                      <span className={cn("w-20 text-right text-[12px] font-semibold tabular", p ? "text-positive" : "")}>{a}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Comptabilité */}
            <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xs">
              <div className="p-6 pb-0">
                <span className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent"><Receipt className="size-[18px]" /></span>
                <h3 className="mt-4 text-[17px] font-semibold">Comptabilité invisible</h3>
                <p className="mt-1.5 max-w-md text-[14px] leading-relaxed text-muted">Chaque mouvement devient une écriture en partie double, conforme au plan comptable associatif. Vous parlez « recettes et dépenses », le logiciel parle 706 et 512.</p>
              </div>
              <div className="mt-6 grid flex-1 items-center gap-3 px-6 pb-6 sm:grid-cols-[1fr_auto_1fr]">
                <div className="rounded-xl border border-border bg-background p-3 text-center">
                  <p className="text-[11px] text-subtle">Vous voyez</p>
                  <p className="mt-1 text-[13px] font-medium">Cotisation de M. Martin</p>
                  <p className="text-[15px] font-semibold text-positive tabular">+ 45,00 €</p>
                </div>
                <ArrowRight className="size-4 rotate-90 justify-self-center text-subtle sm:rotate-0" />
                <div className="rounded-xl border border-border bg-background p-3 font-mono text-[11px]">
                  <p className="text-center font-sans text-[11px] text-subtle">Le logiciel écrit</p>
                  <div className="mt-1.5 flex justify-between gap-2"><span>512 Banque</span><span className="tabular">45,00 D</span></div>
                  <div className="flex justify-between gap-2"><span>756 Cotisations</span><span className="tabular">45,00 C</span></div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-border bg-surface p-5 shadow-xs transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-sm">
                <span className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent"><f.icon className="size-[18px]" /></span>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{f.text}</p>
              </div>
            ))}
          </div>

          {ai && (
            <div className="relative mt-4 overflow-hidden rounded-2xl border border-accent/25 bg-[linear-gradient(135deg,var(--accent-soft),var(--surface)_60%)] p-6 sm:p-8 md:flex md:items-center md:gap-8">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent text-white shadow-md"><Bot className="size-6" /></span>
              <div className="mt-4 md:mt-0">
                <h3 className="text-[17px] font-semibold">Un assistant financier qui connaît vos comptes</h3>
                <p className="mt-1.5 max-w-3xl text-[14px] leading-relaxed text-muted">« Notre trésorerie tiendra-t-elle jusqu&apos;en juin ? », « Explique-moi les fonds dédiés », « Rédige le rapport financier de l&apos;AG » : il répond à partir de vos chiffres réels, sans jamais les inventer.</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ——— Sécurité (bandeau sombre) ——— */}
      <section id="securite" className="scroll-mt-14 bg-[oklch(0.17_0.012_280)] text-white dark:border-y dark:border-border">
        <div className="relative mx-auto max-w-6xl overflow-hidden px-5 py-24">
          <div aria-hidden className="pointer-events-none absolute -top-40 right-0 size-[520px] rounded-full bg-[radial-gradient(circle,oklch(0.55_0.22_277/0.35),transparent_65%)]" />
          <div className="relative grid gap-12 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <Eyebrow className="text-[oklch(0.75_0.14_277)]">Sécurité</Eyebrow>
              <h2 className="mt-3 text-[32px] leading-tight font-semibold tracking-[-0.03em] sm:text-[40px]">La confiance, par construction.</h2>
              <p className="mt-4 max-w-md text-[16px] leading-relaxed text-white/65">Les règles comptables sont garanties par la base de données elle-même, pas seulement par l&apos;interface.</p>
            </div>
            <ul className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2">
              {SECURITY.map(({ icon: Icon, t, d }) => (
                <li key={t} className="bg-[oklch(0.19_0.012_280)] p-6">
                  <Icon className="size-5 text-[oklch(0.75_0.14_277)]" />
                  <h3 className="mt-4 font-semibold">{t}</h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/60">{d}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ——— FAQ ——— */}
      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-24 lg:grid-cols-[1fr_1.6fr]">
        <div>
          <Eyebrow>Questions fréquentes</Eyebrow>
          <h2 className="mt-3 text-[32px] leading-tight font-semibold tracking-[-0.03em]">Vous vous demandez peut-être…</h2>
          <p className="mt-4 text-muted">D&apos;autres questions ? Consultez la page <Link href="/tarifs" className="font-medium text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground">Tarifs</Link> ou écrivez-nous depuis votre espace.</p>
        </div>
        <div className="divide-y divide-border border-y border-border">
          {faq.map(([q, a]) => (
            <details key={q} className="group py-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15.5px] font-medium">
                {q}
                <span className="grid size-6 shrink-0 place-items-center rounded-full border border-border text-muted transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 pr-10 text-[14.5px] leading-relaxed text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ——— Appel final ——— */}
      <section className="px-5 pb-24">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-accent px-6 py-16 text-center text-white sm:py-20">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_50%_120%,rgb(255_255_255/0.22),transparent),radial-gradient(ellipse_40%_60%_at_0%_0%,rgb(192_38_211/0.35),transparent)]" />
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.07)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,#000,transparent_75%)]" />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-[32px] leading-tight font-semibold tracking-[-0.03em] text-balance sm:text-[44px]">
              {beta ? "Gratuit pendant la phase de lancement." : "Votre prochaine AG, sans stress."}
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-[16px] text-white/80">
              {beta ? "Profitez de toutes les fonctionnalités, sans limite et sans carte bancaire." : `Gratuit pour démarrer, puis ${price} HT par mois pour tout débloquer.`}
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 rounded-lg border-0 bg-white px-6 text-[15px] text-[oklch(0.3_0.15_277)] shadow-lg hover:bg-white/90">
                <Link href="/inscription">Créer mon espace gratuit <ArrowRight /></Link>
              </Button>
              <Button asChild size="lg" className="h-12 rounded-lg border-white/25 bg-white/10 px-6 text-[15px] text-white shadow-none hover:border-white/40 hover:bg-white/15">
                <Link href="/tarifs">Voir les tarifs</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
