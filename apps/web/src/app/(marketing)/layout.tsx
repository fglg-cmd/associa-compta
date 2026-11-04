import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-5">
          <Link href="/"><Logo /></Link>
          <nav className="hidden gap-6 text-[13.5px] text-muted md:flex">
            <Link href="/#fonctionnalites" className="hover:text-foreground">Fonctionnalités</Link>
            <Link href="/#securite" className="hover:text-foreground">Sécurité</Link>
            <Link href="/tarifs" className="hover:text-foreground">Tarifs</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <Button asChild variant="primary"><Link href="/app">Ouvrir l&apos;application</Link></Button>
            ) : (
              <>
                <Button asChild variant="ghost"><Link href="/connexion">Connexion</Link></Button>
                <Button asChild variant="primary"><Link href="/inscription">Essayer gratuitement</Link></Button>
              </>
            )}
          </div>
        </div>
      </header>
      {children}
      <footer className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 text-[13px] text-muted sm:grid-cols-4">
          <div className="sm:col-span-2"><Logo /><p className="mt-3 max-w-xs">La gestion financière des associations, simple, juste et conforme.</p></div>
          <div className="grid content-start gap-2"><span className="font-medium text-foreground">Produit</span><Link href="/#fonctionnalites">Fonctionnalités</Link><Link href="/tarifs">Tarifs</Link><Link href="/inscription">Créer un compte</Link></div>
          <div className="grid content-start gap-2"><span className="font-medium text-foreground">Légal</span><Link href="/mentions-legales">Mentions légales</Link><Link href="/cgu">Conditions d&apos;utilisation</Link><Link href="/confidentialite">Confidentialité et RGPD</Link></div>
        </div>
        <div className="border-t border-border py-5 text-center text-xs text-subtle">© {new Date().getFullYear()} ASSOCIA COMPTA · Conçu en France · Données hébergées dans l&apos;Union européenne</div>
      </footer>
    </div>
  );
}
