import Link from "next/link";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-12">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,color-mix(in_oklch,var(--accent)_14%,transparent),transparent)]" />
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
  );
}
