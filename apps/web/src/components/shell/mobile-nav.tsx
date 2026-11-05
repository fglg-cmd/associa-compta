"use client";
import { useState } from "react";
import * as D from "@radix-ui/react-dialog";
import { Menu, Search, X } from "lucide-react";
import { NavLinks, OrgSwitcher, UserMenu } from "./sidebar";
import type { ShellProps } from "./nav";

export function MobileNav(props: ShellProps) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur lg:hidden">
      <D.Root open={open} onOpenChange={setOpen}>
        <D.Trigger className="rounded-md p-1.5 hover:bg-surface-2" aria-label="Menu">
          <Menu className="size-5" />
        </D.Trigger>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-40 bg-black/40 data-[state=open]:animate-fade-in" />
          <D.Content className="fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col gap-3 border-r border-border bg-background p-3 shadow-lg">
            <D.Title className="sr-only">Navigation</D.Title>
            <D.Description className="sr-only">Menu principal</D.Description>
            <div className="flex items-center gap-1">
              <OrgSwitcher org={props.org} orgs={props.orgs} />
              <D.Close className="rounded-md p-1.5 hover:bg-surface-2" aria-label="Fermer"><X className="size-4" /></D.Close>
            </div>
            <NavLinks slug={props.org.slug} pendingCount={props.pendingCount} aiEnabled={props.aiEnabled} onNavigate={() => setOpen(false)} />
            <div className="mt-auto"><UserMenu user={props.user} isPlatformAdmin={props.isPlatformAdmin} slug={props.org.slug} /></div>
          </D.Content>
        </D.Portal>
      </D.Root>
      <span className="flex-1 truncate text-sm font-semibold">{props.org.name}</span>
      <button onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))} className="rounded-md p-1.5 hover:bg-surface-2" aria-label="Rechercher">
        <Search className="size-4" />
      </button>
    </header>
  );
}
