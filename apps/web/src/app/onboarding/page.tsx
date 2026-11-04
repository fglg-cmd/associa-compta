import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/logo";
import { OnboardingForm } from "./onboarding-form";

export const metadata = { title: "Créer votre association" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ nouvelle?: string }> }) {
  const user = await requireUser();
  const { nouvelle } = await searchParams;
  const supabase = await createClient();
  const { count } = await supabase.from("memberships").select("*", { count: "exact", head: true }).eq("user_id", user.id);
  if (count && !nouvelle) redirect("/app");

  return (
    <div className="min-h-dvh px-4 py-12">
      <div className="mx-auto max-w-xl">
        <Logo className="mb-10 text-lg" />
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Configurons votre association</h1>
        <p className="mt-1.5 text-sm text-muted">
          Trois informations suffisent. Nous créons pour vous le plan comptable associatif, les journaux et votre premier exercice.
        </p>
        <OnboardingForm />
      </div>
    </div>
  );
}
