import Link from "next/link";
import { Check } from "lucide-react";
import { Logo } from "@/components/logo";

const POINTS = [
  "Vos relevés bancaires catégorisés automatiquement",
  "Une comptabilité en partie double conforme, sans saisie",
  "Bilan et compte de résultat prêts pour l'assemblée générale",
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,560px)]">
      <div className="relative grid place-items-center overflow-hidden px-4 py-12">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,color-mix(in_oklch,var(--accent)_14%,transparent),transparent)] lg:hidden" />
        <div className="relative w-full max-w-[380px]">
          <Link href="/" className="mb-8 flex justify-center">
            <Logo className="text-lg" />
          </Link>
          {children}
          <p className="mt-8 text-center text-xs text-subtle">
            Données hébergées dans l&apos;Union européenne ·{" "}
            <Link href="/confidentialite" className="hover:text-foreground">Confidentialité</Link>
          </p>
        </div>
      </div>

      <aside className="relative hidden overflow-hidden bg-accent text-white lg:flex lg:flex-col lg:justify-center lg:px-14">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_100%_0%,rgb(192_38_211/0.35),transparent),radial-gradient(ellipse_60%_60%_at_0%_100%,rgb(255_255_255/0.18),transparent)]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.07)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,#000,transparent_80%)]" />
        <div className="relative max-w-md">
          <h2 className="text-[34px] leading-[1.1] font-semibold tracking-[-0.035em] text-balance">La comptabilité de votre association, enfin simple.</h2>
          <ul className="mt-8 grid gap-3.5 text-[15px] text-white/85">
            {POINTS.map((p) => (
              <li key={p} className="flex gap-3">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-white/20"><Check className="size-3" strokeWidth={3} /></span>
                {p}
              </li>
            ))}
          </ul>

          <div className="mt-12 rounded-2xl border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between text-[12px] text-white/70">
              <span>Cotisation · M. Martin</span>
              <span className="rounded-full bg-white/20 px-2 py-0.5 font-medium text-white">Équilibrée</span>
            </div>
            <div className="mt-3 grid gap-1.5 font-mono text-[12px]">
              <div className="flex justify-between rounded-lg bg-white/10 px-3 py-2"><span>512 Banque</span><span className="tabular">45,00 D</span></div>
              <div className="flex justify-between rounded-lg bg-white/10 px-3 py-2"><span>756 Cotisations</span><span className="tabular">45,00 C</span></div>
            </div>
            <p className="mt-3 text-[11.5px] text-white/60">Exemple d&apos;écriture générée automatiquement</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
