"use client";
import { useState } from "react";
import Link from "next/link";
import * as D from "@radix-ui/react-dialog";
import { ArrowRight, Menu, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { SocialLinks } from "@/components/social";
import { useSignedIn } from "./auth-buttons";

/** Menu de navigation du site public sur téléphone (le menu horizontal est masqué). */
export function MobileMenu({ links }: { links: readonly (readonly [string, string])[] }) {
  const signedIn = useSignedIn();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <D.Root open={open} onOpenChange={setOpen}>
      <D.Trigger className="grid size-9 place-items-center rounded-lg border border-border bg-surface text-foreground shadow-xs md:hidden" aria-label="Ouvrir le menu">
        <Menu className="size-[18px]" />
      </D.Trigger>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] data-[state=open]:animate-fade-in md:hidden" />
        <D.Content className="fixed inset-x-0 top-0 z-50 rounded-b-2xl border-b border-border bg-background px-4 pt-2.5 pb-6 shadow-lg data-[state=open]:animate-[menu-in_200ms_cubic-bezier(0.16,1,0.3,1)] md:hidden">
          <D.Title className="sr-only">Menu</D.Title>
          <D.Description className="sr-only">Navigation du site</D.Description>
          <div className="flex h-9 items-center justify-between">
            <Link href="/" onClick={close}><Logo /></Link>
            <D.Close className="grid size-9 place-items-center rounded-lg border border-border bg-surface shadow-xs" aria-label="Fermer le menu">
              <X className="size-[18px]" />
            </D.Close>
          </div>
          <nav className="mt-5 grid">
            {links.map(([href, label]) => (
              <Link key={href} href={href} onClick={close} className="flex items-center justify-between border-b border-border py-3.5 text-[16px] font-medium">
                {label}
                <ArrowRight className="size-4 text-subtle" />
              </Link>
            ))}
          </nav>
          <div className="mt-5 grid gap-2.5">
            {signedIn ? (
              <Button asChild variant="primary" size="lg" className="h-11 rounded-lg"><Link href="/app" onClick={close}>Ouvrir l&apos;application</Link></Button>
            ) : (
              <>
                <Button asChild variant="primary" size="lg" className="h-11 rounded-lg"><Link href="/inscription" onClick={close}>Commencer gratuitement</Link></Button>
                <Button asChild size="lg" className="h-11 rounded-lg"><Link href="/connexion" onClick={close}>Se connecter</Link></Button>
              </>
            )}
          </div>
          <SocialLinks className="mt-5 justify-center" />
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
