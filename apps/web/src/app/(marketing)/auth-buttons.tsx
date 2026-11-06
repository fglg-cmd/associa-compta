"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Le site public est désormais statique (servi instantanément) : on détecte la session
 * côté navigateur, via la présence du cookie Supabase, pour proposer « Ouvrir l'application ».
 */
export function useSignedIn() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    setSignedIn(/(^|;\s*)sb-[^=]+-auth-token(\.0)?=/.test(document.cookie));
  }, []);
  return signedIn;
}

export function AuthButtons() {
  const signedIn = useSignedIn();
  if (signedIn) return <Button asChild variant="primary"><Link href="/app">Ouvrir l&apos;application</Link></Button>;
  return (
    <>
      <Button asChild variant="ghost" className="hidden sm:inline-flex"><Link href="/connexion">Connexion</Link></Button>
      <Button asChild variant="primary"><Link href="/inscription"><span className="sm:hidden">Essayer</span><span className="hidden sm:inline">Essayer gratuitement</span></Link></Button>
    </>
  );
}
