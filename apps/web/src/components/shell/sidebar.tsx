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
      <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none hover:bg-surface/70">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[linear-gradient(135deg,var(--accent),color-mix(in_oklch,var(--accent)_60%,#c026d3))] text-[10.5px] font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2)]">{initials(org.name)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold leading-tight">{org.name}</span>
          <span className="block text-[11px] leading-tight text-subtle">Espace trésorier</span>
        </span>
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
  const items = NAV.filter((n) => aiEnabled || n.href !== "/assistant");
  const groups: { name: string; items: (typeof items)[number][] }[] = [];
  for (const it of items) {
    const g = groups.at(-1);
    if (g && g.name === it.group) g.items.push(it);
    else groups.push({ name: it.group, items: [it] });
  }
  const link = (item: { href: string; label: string; icon: typeof SETTINGS_NAV.icon }) => {
    const href = base + item.href;
    const active = item.href === "" ? pathname === base : pathname.startsWith(href);
    const Icon = item.icon;
    return (
      <Link
        key={item.label}
        href={href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13.5px] font-medium transition-colors",
          active ? "bg-surface text-foreground shadow-[0_1px_2px_hsl(var(--shadow-color)/0.06),0_0_0_1px_var(--border)]" : "text-muted hover:bg-surface/70 hover:text-foreground",
        )}
      >
        <Icon className={cn("size-4 transition-colors", active ? "text-accent" : "text-subtle group-hover:text-muted")} />
        <span className="flex-1">{item.label}</span>
        {item.href === "/banque" && pendingCount > 0 && (
          <span className="rounded-full bg-accent px-1.5 text-[10.5px] font-semibold leading-[18px] text-white tabular">{pendingCount > 99 ? "99+" : pendingCount}</span>
        )}
      </Link>
    );
  };
  return (
    <nav className="grid gap-4">
      {groups.map((g) => (
        <div key={g.name || g.items[0]!.label} className="grid gap-0.5">
          {g.name && <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">{g.name}</p>}
          {g.items.map(link)}
        </div>
      ))}
      <div className="grid gap-0.5 border-t border-border pt-3">{link(SETTINGS_NAV)}</div>
    </nav>
  );
}

export function UserMenu({ user, isPlatformAdmin, slug }: Pick<ShellProps, "user" | "isPlatformAdmin"> & { slug: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none hover:bg-surface/70">
        {user.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatar} alt="" className="size-7 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <span className="grid size-7 shrink-0 place-items-center rounded-full border border-border bg-surface text-[10.5px] font-semibold">{initials(user.name ?? user.email)}</span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium leading-tight">{user.name ?? user.email}</span>
          {user.name && <span className="block truncate text-[11px] leading-tight text-subtle">{user.email}</span>}
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-subtle" />
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
    <aside className="sticky top-0 hidden h-dvh w-[244px] shrink-0 flex-col overflow-y-auto border-r border-border bg-sidebar px-3 py-3 scrollbar-thin lg:flex">
      <div className="mb-3 flex items-center gap-1">
        <OrgSwitcher org={props.org} orgs={props.orgs} />
      </div>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
        className="mb-5 flex h-8 items-center gap-2 rounded-lg border border-border bg-surface px-2.5 text-[13px] text-subtle shadow-xs transition-colors hover:border-border-strong hover:text-muted"
      >
        <Search className="size-3.5" />
        <span className="flex-1 text-left">Rechercher…</span>
        <Kbd>⌘K</Kbd>
      </button>
      <NavLinks slug={props.org.slug} pendingCount={props.pendingCount} aiEnabled={props.aiEnabled} />
      <div className="mt-auto grid gap-2 pt-4">
        {props.beta ? (
          <div className="rounded-xl border border-accent/25 bg-[linear-gradient(135deg,var(--accent-soft),var(--surface))] p-3 text-[12.5px]">
            <span className="flex items-center gap-1.5 font-semibold text-accent"><LogoMark className="size-4" /> Phase de lancement</span>
            <span className="mt-1 block text-muted">Toutes les fonctionnalités sont gratuites et illimitées.</span>
          </div>
        ) : props.org.plan === "free" && (
          <Link href={`/app/${props.org.slug}/parametres?onglet=abonnement`} className="group rounded-xl border border-border bg-surface p-3 text-[12.5px] shadow-xs transition-colors hover:border-accent/40">
            <span className="flex items-center gap-1.5 font-semibold"><LogoMark className="size-4" /> Offre Découverte</span>
            <span className="mt-1 block text-muted">Passez à Essentiel pour l&apos;OCR illimité, les relances et plus encore.</span>
            <span className="mt-2 inline-flex items-center gap-1 font-medium text-accent">Découvrir les offres <span className="transition-transform group-hover:translate-x-0.5">→</span></span>
          </Link>
        )}
        <UserMenu user={props.user} isPlatformAdmin={props.isPlatformAdmin} slug={props.org.slug} />
      </div>
    </aside>
  );
}
