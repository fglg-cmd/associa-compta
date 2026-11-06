import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth";

const NAV = [
  ["/#fonctionnement", "Comment ça marche"],
  ["/#fonctionnalites", "Fonctionnalités"],
  ["/#securite", "Sécurité"],
  ["/tarifs", "Tarifs"],
] as const;

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/75 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:gap-8 sm:px-5">
          <Link href="/"><Logo /></Link>
          <nav className="hidden gap-1 text-[13.5px] text-muted md:flex">
            {NAV.map(([href, label]) => (
              <Link key={href} href={href} className="rounded-md px-2.5 py-1.5 transition-colors hover:bg-surface-2 hover:text-foreground">{label}</Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <Button asChild variant="primary"><Link href="/app">Ouvrir l&apos;application</Link></Button>
            ) : (
              <>
                <Button asChild variant="ghost" className="hidden sm:inline-flex"><Link href="/connexion">Connexion</Link></Button>
                <Button asChild variant="ghost" className="sm:hidden"><Link href="/connexion">Se connecter</Link></Button>
                <Button asChild variant="primary"><Link href="/inscription"><span className="sm:hidden">Essayer</span><span className="hidden sm:inline">Essayer gratuitement</span></Link></Button>
              </>
            )}
          </div>
        </div>
      </header>
      {children}
      <footer className="border-t border-border bg-surface/50">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 text-[13.5px] text-muted sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs leading-relaxed">La gestion financière des associations, simple, juste et conforme.</p>
            <Button asChild variant="primary" className="mt-5"><Link href="/inscription">Créer mon espace gratuit</Link></Button>
          </div>
          <div className="grid content-start gap-2.5"><span className="font-medium text-foreground">Produit</span>{NAV.map(([href, label]) => <Link key={href} href={href} className="hover:text-foreground">{label}</Link>)}</div>
          <div className="grid content-start gap-2.5"><span className="font-medium text-foreground">Légal</span><Link href="/mentions-legales" className="hover:text-foreground">Mentions légales</Link><Link href="/cgu" className="hover:text-foreground">Conditions d&apos;utilisation</Link><Link href="/confidentialite" className="hover:text-foreground">Confidentialité et RGPD</Link></div>
        </div>
        <div className="border-t border-border">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-5 py-5 text-xs text-subtle sm:flex-row sm:justify-between">
            <span>© {new Date().getFullYear()} ASSOCIA COMPTA</span>
            <span>Conçu en France · Données hébergées dans l&apos;Union européenne</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
