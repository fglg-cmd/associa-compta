"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/browser";
import { publicEnv } from "@/lib/public-env";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3 14.7 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.7H12z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path fill="#F25022" d="M2 2h9.5v9.5H2z" />
      <path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" />
      <path fill="#00A4EF" d="M2 12.5h9.5V22H2z" />
      <path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" />
    </svg>
  );
}

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next")?.startsWith("/") ? params.get("next")! : "/app";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(params.get("error"));

  const redirectTo = `${publicEnv.appUrl}/auth/callback?next=${encodeURIComponent(next)}`;
  const supabase = getBrowserClient();

  async function oauth(provider: "google" | "azure") {
    setLoading(provider);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, scopes: provider === "azure" ? "email openid profile" : undefined },
    });
    if (error) {
      setError(error.message);
      setLoading(null);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading("email");
    try {
      if (mode === "signup") {
        if (password.length < 10) throw new Error("Le mot de passe doit contenir au moins 10 caractères.");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo, data: { full_name: fullName } },
        });
        if (error) throw error;
        if (data.session) router.push(next !== "/app" ? next : "/onboarding");
        else setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message === "Invalid login credentials" ? "E-mail ou mot de passe incorrect." : error.message);
        router.push(next);
        router.refresh();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(null);
    }
  }

  async function magicLink() {
    if (!email) {
      setError("Saisissez votre adresse e-mail.");
      return;
    }
    setLoading("magic");
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    setLoading(null);
    if (error) setError(error.message);
    else {
      setSent(true);
      toast.success("Lien de connexion envoyé");
    }
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center shadow-sm">
        <div className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-accent-soft text-accent">
          <Mail className="size-5" />
        </div>
        <h1 className="font-semibold">Vérifiez votre boîte mail</h1>
        <p className="mt-1 text-sm text-muted">
          Un lien a été envoyé à <strong className="text-foreground">{email}</strong>. Il est valable une heure.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h1 className="text-lg font-semibold tracking-[-0.01em]">
        {mode === "signin" ? "Bon retour parmi nous" : "Créez votre compte gratuit"}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {mode === "signin" ? "Connectez-vous à votre espace trésorier." : "Sans carte bancaire. Prêt en deux minutes."}
      </p>

      <div className="mt-5 grid gap-2">
        <Button size="lg" onClick={() => oauth("google")} loading={loading === "google"} disabled={!!loading}>
          <GoogleIcon /> Continuer avec Google
        </Button>
        <Button size="lg" onClick={() => oauth("azure")} loading={loading === "azure"} disabled={!!loading}>
          <MicrosoftIcon /> Continuer avec Microsoft
        </Button>
      </div>

      <div className="my-5 flex items-center gap-3 text-xs text-subtle">
        <div className="h-px flex-1 bg-border" /> ou par e-mail <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={submit} className="grid gap-3">
        {mode === "signup" && (
          <Field label="Nom complet" htmlFor="name">
            <Input id="name" autoComplete="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Field>
        )}
        <Field label="Adresse e-mail" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tresorier@monasso.fr" />
        </Field>
        <Field
          label={
            <span className="flex w-full justify-between">
              Mot de passe
              {mode === "signin" && (
                <Link href="/mot-de-passe" className="font-normal text-muted hover:text-foreground">Oublié ?</Link>
              )}
            </span>
          }
          htmlFor="password"
          hint={mode === "signup" ? "10 caractères minimum." : undefined}
        >
          <Input id="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} required minLength={mode === "signup" ? 10 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <p className="rounded-md bg-negative-soft px-3 py-2 text-[13px] text-negative">{error}</p>}
        <Button type="submit" variant="primary" size="lg" loading={loading === "email"} disabled={!!loading}>
          {mode === "signin" ? "Se connecter" : "Créer mon compte"}
        </Button>
        {mode === "signin" && (
          <Button type="button" variant="ghost" onClick={magicLink} loading={loading === "magic"} disabled={!!loading}>
            Recevoir un lien de connexion par e-mail
          </Button>
        )}
      </form>

      <p className="mt-5 text-center text-[13px] text-muted">
        {mode === "signin" ? (
          <>Pas encore de compte ? <Link className="font-medium text-accent hover:underline" href="/inscription">Commencer gratuitement</Link></>
        ) : (
          <>Déjà inscrit ? <Link className="font-medium text-accent hover:underline" href="/connexion">Se connecter</Link></>
        )}
      </p>
      {mode === "signup" && (
        <p className="mt-3 text-center text-[11.5px] text-subtle">
          En créant un compte, vous acceptez les <Link href="/cgu" className="underline">conditions d&apos;utilisation</Link> et la{" "}
          <Link href="/confidentialite" className="underline">politique de confidentialité</Link>.
        </p>
      )}
    </div>
  );
}
