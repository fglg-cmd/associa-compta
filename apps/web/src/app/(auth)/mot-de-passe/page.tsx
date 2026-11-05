"use client";
import { useState } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/browser";
import { publicEnv } from "@/lib/public-env";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    const { error } = await getBrowserClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/nouveau-mot-de-passe`,
    });
    if (error) {
      setError(error.message);
      setState("idle");
    } else setState("sent");
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h1 className="text-lg font-semibold">Mot de passe oublié</h1>
      {!publicEnv.authEmails ? (
        <p className="mt-2 text-sm text-muted">
          Écrivez-nous à <a className="font-medium text-accent" href={`mailto:${publicEnv.supportEmail}?subject=${encodeURIComponent("Réinitialisation de mot de passe")}`}>{publicEnv.supportEmail}</a> depuis l&apos;adresse de votre compte : nous vous envoyons un lien de réinitialisation sous 24 h.
        </p>
      ) : state === "sent" ? (
        <p className="mt-2 text-sm text-muted">Si un compte existe pour {email}, un lien de réinitialisation vient d&apos;être envoyé.</p>
      ) : (
        <form onSubmit={submit} className="mt-4 grid gap-3">
          <Field label="Adresse e-mail" htmlFor="email">
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {error && <p className="text-[13px] text-negative">{error}</p>}
          <Button type="submit" variant="primary" loading={state === "loading"}>Envoyer le lien</Button>
        </form>
      )}
      <Link href="/connexion" className="mt-4 block text-center text-[13px] text-muted hover:text-foreground">Retour à la connexion</Link>
    </div>
  );
}
