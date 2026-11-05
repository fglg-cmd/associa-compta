"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Check, ChevronsUpDown, LogOut, Moon, Plus, Search, Shield, Sun, LifeBuoy } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { signOut } from "@/modules/org/actions";
import { LogoMark } from "@/components/logo";
import { Kbd } from "@/components/ui/misc";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import { NAV, SETTINGS_NAV, type ShellProps } from "./nav";

export function toggleTheme() {
  const dark = !document.documentElement.classList.contains("dark");
  document.documentElement.classList.toggle("dark", dark);
  try {
    localStorage.setItem("theme", dark ? "dark" : "light");
  } catch {}
}

export function OrgSwitcher({ org, orgs }: Pick<ShellProps, "org" | "orgs">) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface-2 outline-none">
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-accent text-[10px] font-semibold text-white">{initials(org.name)}</span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{org.name}</span>
        <ChevronsUpDown className="size-3.5 text-subtle" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel>Associations</DropdownMenuLabel>
        {orgs.map((o) => (
          <DropdownMenuItem key={o.slug} asChild>
            <Link href={`/app/${o.slug}`}>
              <span className="grid size-5 place-items-center rounded bg-surface-2 text-[9px] font-semibold">{initials(o.name)}</span>
              <span className="flex-1 truncate">{o.name}</span>
              {o.slug === org.slug && <Check />}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/onboarding?nouvelle=1"><Plus /> Nouvelle association</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function NavLinks({ slug, pendingCount, onNavigate, aiEnabled = true }: { slug: string; pendingCount: number; onNavigate?: () => void; aiEnabled?: boolean }) {
  const pathname = usePathname();
  const base = `/app/${slug}`;
  const items = [...NAV.filter((n) => aiEnabled || n.href !== "/assistant"), SETTINGS_NAV];
  return (
    <nav className="grid gap-0.5">
      {items.map((item) => {
        const href = base + item.href;
        const active = item.href === "" ? pathname === base : pathname.startsWith(href);
        const Icon = item.icon;
        return (
          <Link
            key={item.label}
            href={href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-2.5 rounded-md px-2 py-[5px] text-[13px] font-medium transition-colors",
              active ? "bg-surface text-foreground shadow-xs border border-border" : "border border-transparent text-muted hover:bg-surface-2 hover:text-foreground",
              item.href === "/parametres" && "mt-3",
            )}
          >
            <Icon className={cn("size-4", active ? "text-accent" : "text-subtle group-hover:text-muted")} />
            <span className="flex-1">{item.label}</span>
            {item.href === "/banque" && pendingCount > 0 && (
              <span className="rounded-full bg-accent px-1.5 text-[10.5px] font-semibold leading-[18px] text-white tabular">{pendingCount > 99 ? "99+" : pendingCount}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function UserMenu({ user, isPlatformAdmin, slug }: Pick<ShellProps, "user" | "isPlatformAdmin"> & { slug: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left outline-none hover:bg-surface-2">
        {user.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatar} alt="" className="size-6 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <span className="grid size-6 place-items-center rounded-full bg-surface-2 text-[10px] font-semibold border border-border">{initials(user.name ?? user.email)}</span>
        )}
        <span className="min-w-0 flex-1 truncate text-[13px]">{user.name ?? user.email}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-60">
        <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={toggleTheme}>
          <Moon className="dark:hidden" />
          <Sun className="hidden dark:block" /> Changer de thème
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/app/${slug}/parametres?onglet=support`}><LifeBuoy /> Contacter le support</Link>
        </DropdownMenuItem>
        {isPlatformAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/admin"><Shield /> Back-office</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => signOut()}>
          <LogOut /> Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Raccourcis « G puis lettre » façon Linear. */
function useGoShortcuts(slug: string) {
  const router = useRouter();
  useEffect(() => {
    let armed = false;
    let timer: ReturnType<typeof setTimeout>;
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (!armed && k === "g") {
        armed = true;
        timer = setTimeout(() => (armed = false), 900);
        return;
      }
      if (armed) {
        armed = false;
        clearTimeout(timer);
        const item = NAV.find((n) => n.shortcut.endsWith(` ${k.toUpperCase()}`));
        if (item) router.push(`/app/${slug}${item.href}`);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, slug]);
}

export function Sidebar(props: ShellProps) {
  useGoShortcuts(props.org.slug);
  return (
    <aside className="sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col border-r border-border bg-background px-3 py-3 lg:flex">
      <div className="mb-3 flex items-center gap-1">
        <OrgSwitcher org={props.org} orgs={props.orgs} />
      </div>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
        className="mb-4 flex h-8 items-center gap-2 rounded-md border border-border bg-surface px-2 text-[13px] text-subtle shadow-xs hover:border-border-strong"
      >
        <Search className="size-3.5" />
        <span className="flex-1 text-left">Rechercher…</span>
        <Kbd>⌘K</Kbd>
      </button>
      <NavLinks slug={props.org.slug} pendingCount={props.pendingCount} aiEnabled={props.aiEnabled} />
      <div className="mt-auto grid gap-2">
        {props.beta ? (
          <div className="rounded-lg border border-accent/30 bg-accent-soft/50 p-3 text-[12.5px]">
            <span className="flex items-center gap-1.5 font-semibold text-accent"><LogoMark className="size-4" /> Phase de lancement</span>
            <span className="mt-1 block text-muted">Toutes les fonctionnalités sont gratuites et illimitées.</span>
          </div>
        ) : props.org.plan === "free" && (
          <Link href={`/app/${props.org.slug}/parametres?onglet=abonnement`} className="rounded-lg border border-border bg-surface p-3 text-[12.5px] shadow-xs hover:border-border-strong">
            <span className="flex items-center gap-1.5 font-semibold"><LogoMark className="size-4" /> Offre Découverte</span>
            <span className="mt-1 block text-muted">Passez à Essentiel pour l&apos;OCR illimité, les relances et plus encore.</span>
          </Link>
        )}
        <UserMenu user={props.user} isPlatformAdmin={props.isPlatformAdmin} slug={props.org.slug} />
      </div>
    </aside>
  );
}
