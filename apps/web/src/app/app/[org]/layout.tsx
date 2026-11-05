import { getOrgContext, getSessionUser, isPlatformAdmin } from "@/lib/auth";
import { features } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/shell/sidebar";
import { CommandPalette } from "@/components/shell/command-palette";
import { MobileNav } from "@/components/shell/mobile-nav";

export default async function OrgLayout({ children, params }: { children: React.ReactNode; params: Promise<{ org: string }> }) {
  const { org: slug } = await params;
  const ctx = await getOrgContext(slug);
  const user = await getSessionUser();
  const supabase = await createClient();
  const [{ data: memberships }, { count: pending }, admin, { data: profile }] = await Promise.all([
    supabase.from("memberships").select("organizations(name, slug)").eq("user_id", ctx.userId),
    supabase.from("bank_transactions").select("*", { count: "exact", head: true }).eq("organization_id", ctx.org.id).eq("status", "pending"),
    isPlatformAdmin(),
    supabase.from("profiles").select("full_name, avatar_url").eq("id", ctx.userId).maybeSingle<{ full_name: string | null; avatar_url: string | null }>(),
  ]);
  const orgs = ((memberships ?? []) as unknown as { organizations: { name: string; slug: string } }[]).map((m) => m.organizations);

  const shellProps = {
    org: { name: ctx.org.name, slug: ctx.org.slug, plan: ctx.org.plan },
    orgs,
    user: { email: user?.email ?? "", name: profile?.full_name ?? null, avatar: profile?.avatar_url ?? null },
    role: ctx.role,
    pendingCount: pending ?? 0,
    isPlatformAdmin: admin,
    aiEnabled: features.ai,
  };

  return (
    <div className="flex min-h-dvh">
      <Sidebar {...shellProps} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav {...shellProps} />
        <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
      <CommandPalette slug={ctx.org.slug} canWrite={ctx.canWrite} aiEnabled={features.ai} />
    </div>
  );
}
