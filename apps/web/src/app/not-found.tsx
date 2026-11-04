import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <p className="font-mono text-sm text-subtle">404</p>
        <h1 className="mt-2 text-xl font-semibold">Page introuvable</h1>
        <p className="mt-1 text-sm text-muted">Cette page n&apos;existe pas ou vous n&apos;y avez pas accès.</p>
        <Button asChild variant="primary" className="mt-5"><Link href="/app">Retour à l&apos;application</Link></Button>
      </div>
    </div>
  );
}
