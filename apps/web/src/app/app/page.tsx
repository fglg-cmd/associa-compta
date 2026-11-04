import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/utils";

export default async function AppIndex() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("memberships")
    .select("role, organizations(name, slug)")
    .eq("user_id", user.id)
    .order("created_at");
  const orgs = (data ?? []) as unknown as { role: string; organizations: { name: string; slug: string } }[];
  if (!orgs.length) redirect("/onboarding");
  if (orgs.length === 1) redirect(`/app/${orgs[0]!.organizations.slug}`);

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-md">
        <Logo className="mb-8 text-lg" />
        <h1 className="text-lg font-semibold">Choisissez une association</h1>
        <div className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
          {orgs.map((o) => (
            <Link key={o.organizations.slug} href={`/app/${o.organizations.slug}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
              <span className="grid size-8 place-items-center rounded-lg bg-accent-soft text-xs font-semibold text-accent">{initials(o.organizations.name)}</span>
              <span className="text-sm font-medium">{o.organizations.name}</span>
            </Link>
          ))}
        </div>
        <Button asChild variant="ghost" className="mt-3">
          <Link href="/onboarding?nouvelle=1"><Plus /> Nouvelle association</Link>
        </Button>
      </div>
    </div>
  );
}
