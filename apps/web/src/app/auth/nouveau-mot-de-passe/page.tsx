"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Logo } from "@/components/logo";

export default function NewPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 10) return setError("10 caractères minimum.");
    setLoading(true);
    const { error } = await getBrowserClient().auth.updateUser({ password });
    setLoading(false);
    if (error) return setError(error.message);
    toast.success("Mot de passe mis à jour");
    router.push("/app");
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 flex justify-center"><Logo className="text-lg" /></div>
        <form onSubmit={submit} className="grid gap-3 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h1 className="text-lg font-semibold">Nouveau mot de passe</h1>
          <Field label="Mot de passe" htmlFor="pw" error={error}>
            <Input id="pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Button type="submit" variant="primary" loading={loading}>Enregistrer</Button>
        </form>
      </div>
    </div>
  );
}
