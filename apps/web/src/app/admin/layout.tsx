import Link from "next/link";
import { notFound } from "next/navigation";
import { isPlatformAdmin, requireUser } from "@/lib/auth";
import { Logo } from "@/components/logo";

export const metadata = { title: "Back-office", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  if (!(await isPlatformAdmin())) notFound();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-6xl items-center gap-6 px-4">
          <Logo />
          <span className="rounded bg-negative-soft px-1.5 py-0.5 text-[11px] font-semibold text-negative">BACK-OFFICE</span>
          <nav className="flex gap-4 text-[13px] text-muted">
            <Link href="/admin" className="hover:text-foreground">Vue d&apos;ensemble</Link>
            <Link href="/admin/associations" className="hover:text-foreground">Clients</Link>
            <Link href="/admin/abonnements" className="hover:text-foreground">Abonnements</Link>
            <Link href="/admin/support" className="hover:text-foreground">Support</Link>
          </nav>
          <Link href="/app" className="ml-auto text-[13px] text-muted hover:text-foreground">Retour à l&apos;app</Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
