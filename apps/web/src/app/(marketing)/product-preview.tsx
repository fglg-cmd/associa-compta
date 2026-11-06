import { BookOpen, FileText, FolderKanban, Home, Landmark, ListOrdered, PieChart, Search, Sparkles, Users } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { cn } from "@/lib/utils";

/*
 * Aperçu du produit pour la page d'accueil : maquette statique en HTML (aucune donnée réelle),
 * fidèle à l'interface de l'application. Les chiffres sont fictifs et signalés comme tels.
 */

const MONTHS = [
  { m: "Jan", r: 62, d: 38 },
  { m: "Fév", r: 48, d: 44 },
  { m: "Mar", r: 85, d: 52 },
  { m: "Avr", r: 54, d: 61 },
  { m: "Mai", r: 70, d: 40 },
  { m: "Juin", r: 92, d: 58 },
];

const TX = [
  { label: "VIR SEPA RECU /FRM DUPONT", cat: "Cotisations des adhérents", amount: "+ 45,00 €", positive: true, ai: false },
  { label: "CB LEROY MERLIN 12/03", cat: "Fournitures et petit matériel", amount: "− 86,40 €", positive: false, ai: true },
  { label: "PRLV SEPA MAIF", cat: "Assurances", amount: "− 212,00 €", positive: false, ai: true },
  { label: "VIR MAIRIE DE RENNES", cat: "Subventions d'exploitation", amount: "+ 1 500,00 €", positive: true, ai: false },
];

const NAV = [
  { i: Home, l: "Accueil", active: true },
  { i: Landmark, l: "Banque", badge: "2" },
  { i: ListOrdered, l: "Opérations" },
  { i: FileText, l: "Justificatifs" },
  { i: Users, l: "Adhérents" },
  { i: FolderKanban, l: "Projets" },
  { i: BookOpen, l: "Comptabilité" },
  { i: PieChart, l: "Rapports" },
];

export function ProductPreview() {
  return (
    <div className="relative mx-auto max-w-5xl">
      {/* Halo derrière la maquette */}
      <div aria-hidden className="absolute -inset-x-10 -inset-y-6 -z-10 rounded-[40px] bg-[radial-gradient(ellipse_at_center,color-mix(in_oklch,var(--accent)_18%,transparent),transparent_70%)] blur-2xl" />
      <div className="overflow-hidden rounded-2xl border border-border-strong/70 bg-surface text-left shadow-[0_30px_80px_-20px_hsl(var(--shadow-color)/0.28),0_0_0_1px_hsl(var(--shadow-color)/0.02)] ring-1 ring-black/[0.02]">
        {/* Barre de fenêtre */}
        <div className="flex h-9 items-center gap-2 border-b border-border bg-surface-2/70 px-3.5">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
          <span className="mx-auto hidden h-5 w-64 items-center justify-center rounded-md border border-border bg-surface text-[10.5px] text-subtle sm:flex">associa-compta.fr/app/judo-club</span>
          <span className="ml-auto text-[10px] text-subtle sm:ml-0">Données fictives</span>
        </div>

        <div className="flex">
          {/* Barre latérale */}
          <div className="hidden w-[178px] shrink-0 flex-col gap-0.5 border-r border-border bg-background p-2.5 md:flex">
            <div className="mb-2 flex items-center gap-2 px-1.5 py-1">
              <span className="grid size-5 place-items-center rounded bg-accent text-[9px] font-semibold text-white">JC</span>
              <span className="truncate text-[11.5px] font-semibold">Judo Club Rennais</span>
            </div>
            <div className="mb-2 flex h-6 items-center gap-1.5 rounded-md border border-border bg-surface px-1.5 text-[10.5px] text-subtle">
              <Search className="size-3" /> Rechercher…
            </div>
            {NAV.map(({ i: Icon, l, active, badge }) => (
              <div key={l} className={cn("flex items-center gap-2 rounded-md border px-1.5 py-[3px] text-[11px] font-medium", active ? "border-border bg-surface text-foreground shadow-xs" : "border-transparent text-muted")}>
                <Icon className={cn("size-3.5", active ? "text-accent" : "text-subtle")} />
                <span className="flex-1">{l}</span>
                {badge && <span className="rounded-full bg-accent px-1.5 text-[9px] font-semibold leading-[15px] text-white">{badge}</span>}
              </div>
            ))}
          </div>

          {/* Contenu */}
          <div className="min-w-0 flex-1 bg-background p-4 sm:p-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10.5px] text-subtle">Exercice 2026</p>
                <p className="text-[15px] font-semibold tracking-[-0.02em]">Bonjour Camille</p>
              </div>
              <span className="hidden items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[10.5px] font-medium text-accent sm:inline-flex">
                <Sparkles className="size-3" /> 2 mouvements à valider
              </span>
            </div>

            <div className="mt-3.5 grid grid-cols-3 gap-2 sm:gap-2.5">
              {[
                { l: "Trésorerie disponible", v: "12 480 €", d: "+ 8,2 %", pos: true },
                { l: "Recettes", v: "18 230 €", d: "sur l'exercice", pos: null },
                { l: "Résultat", v: "+ 3 915 €", d: "Excédent", pos: true },
              ].map((k) => (
                <div key={k.l} className="rounded-lg border border-border bg-surface p-2.5 shadow-xs sm:p-3">
                  <p className="truncate text-[9.5px] text-muted sm:text-[10.5px]">{k.l}</p>
                  <p className="mt-0.5 text-[13px] font-semibold tabular tracking-[-0.02em] sm:text-[17px]">{k.v}</p>
                  <p className={cn("text-[9.5px] sm:text-[10px]", k.pos ? "text-positive" : "text-subtle")}>{k.d}</p>
                </div>
              ))}
            </div>

            <div className="mt-2.5 grid gap-2.5 lg:grid-cols-[1.1fr_1fr]">
              {/* Graphique */}
              <div className="rounded-lg border border-border bg-surface p-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold">Recettes et dépenses</p>
                  <div className="flex gap-2.5 text-[9.5px] text-muted">
                    <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-chart-1" />Recettes</span>
                    <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-chart-2" />Dépenses</span>
                  </div>
                </div>
                <div className="mt-3 flex h-[104px] items-end gap-2.5 border-b border-border pb-px sm:gap-3.5">
                  {MONTHS.map((x) => (
                    <div key={x.m} className="flex h-full flex-1 items-end justify-center gap-[3px]">
                      <span className="w-full max-w-3 rounded-t-[3px] bg-chart-1" style={{ height: `${x.r}%` }} />
                      <span className="w-full max-w-3 rounded-t-[3px] bg-chart-2/85" style={{ height: `${x.d}%` }} />
                    </div>
                  ))}
                </div>
                <div className="mt-1 flex gap-2.5 sm:gap-3.5">
                  {MONTHS.map((x) => <span key={x.m} className="flex-1 text-center text-[9px] text-subtle">{x.m}</span>)}
                </div>
              </div>

              {/* Mouvements */}
              <div className="rounded-lg border border-border bg-surface shadow-xs">
                <p className="px-3 pt-2.5 pb-1.5 text-[11px] font-semibold">Derniers mouvements</p>
                <ul className="divide-y divide-border">
                  {TX.map((t) => (
                    <li key={t.label} className="flex items-center gap-2 px-3 py-[7px]">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-[9.5px] text-muted">{t.label}</p>
                        <p className="mt-0.5 flex items-center gap-1 truncate text-[10.5px] font-medium">
                          {t.ai && <Sparkles className="size-2.5 shrink-0 text-accent" />}
                          {t.cat}
                        </p>
                      </div>
                      <span className={cn("shrink-0 text-[10.5px] font-semibold tabular", t.positive ? "text-positive" : "text-foreground")}>{t.amount}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Carte flottante : écriture générée */}
      <div className="absolute -bottom-6 -left-3 hidden w-60 rounded-xl border border-border bg-surface p-3 shadow-lg lg:block xl:-left-10">
        <div className="flex items-center gap-2">
          <LogoMark className="size-4" />
          <p className="text-[11px] font-semibold">Écriture générée</p>
          <span className="ml-auto rounded-full bg-positive-soft px-1.5 text-[9.5px] font-medium leading-4 text-positive">Équilibrée</span>
        </div>
        <div className="mt-2 grid gap-1 font-mono text-[10px]">
          <div className="flex justify-between rounded bg-surface-2 px-2 py-1"><span>606 Fournitures</span><span className="tabular">86,40 D</span></div>
          <div className="flex justify-between rounded bg-surface-2 px-2 py-1"><span>512 Banque</span><span className="tabular">86,40 C</span></div>
        </div>
      </div>
    </div>
  );
}
