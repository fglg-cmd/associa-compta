import { requireUser } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { AcceptInvitation } from "./accept";

export const metadata = { title: "Invitation" };

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await requireUser();
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-[380px] rounded-xl border border-border bg-surface p-6 text-center shadow-sm">
        <Logo className="mb-6 justify-center" />
        <h1 className="text-lg font-semibold">Rejoindre l&apos;association</h1>
        <p className="mt-1 text-sm text-muted">Vous êtes connecté en tant que <strong className="text-foreground">{user.email}</strong>.</p>
        <AcceptInvitation token={token} />
      </div>
    </div>
  );
}
